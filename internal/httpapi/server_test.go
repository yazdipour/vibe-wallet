package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/sh-yazdipour/vibe-badget/internal/db"
	"github.com/sh-yazdipour/vibe-badget/internal/model"
	"github.com/sh-yazdipour/vibe-badget/internal/store"
)

func TestUploadAndList(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	h := NewServer(store.New(d), os.DirFS("."))

	csvData := `"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
2026-04-21,2026-04-21,"LIDL DANKT",AT123,"Card Payment",Groceries,Main,-23.45,,,
`
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", "tx.csv")
	fw.Write([]byte(csvData))
	mw.Close()

	req := httptest.NewRequest("POST", "/api/upload", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("upload status %d: %s", rec.Code, rec.Body)
	}
	var up map[string]int
	json.Unmarshal(rec.Body.Bytes(), &up)
	if up["inserted"] != 1 {
		t.Fatalf("want 1 inserted, got %v", up)
	}

	req2 := httptest.NewRequest("GET", "/api/transactions", nil)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Code != 200 || !bytes.Contains(rec2.Body.Bytes(), []byte("LIDL")) {
		t.Fatalf("list status %d body %s", rec2.Code, rec2.Body)
	}
	_ = http.StatusOK
}

func TestSettingsMaskApiKey(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	h := NewServer(store.New(d), os.DirFS("."))

	put := httptest.NewRequest("PUT", "/api/settings",
		bytes.NewBufferString(`{"llm_base_url":"http://x/v1","llm_model":"llama3","llm_api_key":"secret"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, put)
	if rec.Code != 204 {
		t.Fatalf("put settings %d %s", rec.Code, rec.Body)
	}

	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("GET", "/api/settings", nil))
	if bytes.Contains(rec2.Body.Bytes(), []byte("secret")) {
		t.Fatal("api key must not be echoed back")
	}
	if !bytes.Contains(rec2.Body.Bytes(), []byte("llm_api_key_set")) {
		t.Fatalf("expected llm_api_key_set in response, got: %s", rec2.Body)
	}
}

func TestRulesCRUDAndCategorize(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	h := NewServer(store.New(d), os.DirFS("."))

	// list seeded rules
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/rules", nil))
	if rec.Code != 200 || !bytes.Contains(rec.Body.Bytes(), []byte("Lidl")) {
		t.Fatalf("rules list: %d %s", rec.Code, rec.Body)
	}

	// categorize with no LLM still applies rules and streams NDJSON ending in a done line
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/categorize", nil))
	if rec2.Code != 200 {
		t.Fatalf("categorize: %d %s", rec2.Code, rec2.Body)
	}
	if ct := rec2.Header().Get("Content-Type"); ct != "application/x-ndjson" {
		t.Fatalf("want ndjson content-type, got %q", ct)
	}
	lines := bytes.Split(bytes.TrimSpace(rec2.Body.Bytes()), []byte("\n"))
	if len(lines) == 0 {
		t.Fatalf("expected at least one line, got none: %s", rec2.Body)
	}
	var last struct {
		Done bool `json:"done"`
	}
	if err := json.Unmarshal(lines[len(lines)-1], &last); err != nil {
		t.Fatalf("decode last line: %v line=%s", err, lines[len(lines)-1])
	}
	if !last.Done {
		t.Fatalf("last line should have done=true, got %s", lines[len(lines)-1])
	}
}

func TestLLMHealthUnconfigured(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	h := NewServer(store.New(d), os.DirFS("."))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/llm/health", nil))
	if rec.Code != 200 {
		t.Fatalf("health: %d %s", rec.Code, rec.Body)
	}
	var result struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode: %v body=%s", err, rec.Body)
	}
	if result.Status != "unconfigured" {
		t.Fatalf("want unconfigured, got %q (body %s)", result.Status, rec.Body)
	}
}

func TestSetTransactionCategory(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	s := store.New(d)
	h := NewServer(s, os.DirFS("."))

	_, err := s.InsertTransactions([]model.Transaction{
		{AccountName: "Main", PartnerName: "Mystery Shop", DedupeHash: "manual-1"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// find the inserted transaction's id and a category id via the API
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/transactions", nil))
	var txns []struct {
		ID           int64  `json:"id"`
		PartnerName  string `json:"partner_name"`
		CategoryName string `json:"category_name"`
	}
	json.Unmarshal(rec.Body.Bytes(), &txns)
	var txID int64
	for _, t2 := range txns {
		if t2.PartnerName == "Mystery Shop" {
			txID = t2.ID
		}
	}
	if txID == 0 {
		t.Fatalf("could not find inserted transaction: %s", rec.Body)
	}

	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("GET", "/api/categories", nil))
	var cats []struct {
		ID int64 `json:"id"`
	}
	json.Unmarshal(rec2.Body.Bytes(), &cats)
	if len(cats) == 0 {
		t.Fatal("no seeded categories")
	}
	catID := cats[0].ID

	// missing category_id -> 400
	badReq := httptest.NewRequest("PUT", fmt.Sprintf("/api/transactions/%d/category", txID),
		bytes.NewBufferString(`{}`))
	badRec := httptest.NewRecorder()
	h.ServeHTTP(badRec, badReq)
	if badRec.Code != 400 {
		t.Fatalf("want 400 for missing category_id, got %d", badRec.Code)
	}

	// valid assignment -> 204
	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/transactions/%d/category", txID),
		bytes.NewBufferString(fmt.Sprintf(`{"category_id":%d}`, catID)))
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, req)
	if rec3.Code != 204 {
		t.Fatalf("want 204, got %d %s", rec3.Code, rec3.Body)
	}

	// confirm it stuck, categorized_by = manual
	rec4 := httptest.NewRecorder()
	h.ServeHTTP(rec4, httptest.NewRequest("GET", "/api/transactions", nil))
	if !bytes.Contains(rec4.Body.Bytes(), []byte(`"categorized_by":"manual"`)) {
		t.Fatalf("expected categorized_by manual in response: %s", rec4.Body)
	}
}

func TestCreateCategoryWithAndWithoutIconColor(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	h := NewServer(store.New(d), os.DirFS("."))

	// with icon/color
	req := httptest.NewRequest("POST", "/api/categories",
		bytes.NewBufferString(`{"name":"Pets","icon":"PiggyBank","color":"#f59e0b"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 201 {
		t.Fatalf("create with icon/color: %d %s", rec.Code, rec.Body)
	}
	var withIcon struct {
		Icon  string `json:"icon"`
		Color string `json:"color"`
	}
	json.Unmarshal(rec.Body.Bytes(), &withIcon)
	if withIcon.Icon != "PiggyBank" || withIcon.Color != "#f59e0b" {
		t.Fatalf("unexpected response: %s", rec.Body)
	}

	// without icon/color -> defaults apply
	req2 := httptest.NewRequest("POST", "/api/categories",
		bytes.NewBufferString(`{"name":"Bare"}`))
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Code != 201 {
		t.Fatalf("create without icon/color: %d %s", rec2.Code, rec2.Body)
	}
	var withoutIcon struct {
		Icon  string `json:"icon"`
		Color string `json:"color"`
	}
	json.Unmarshal(rec2.Body.Bytes(), &withoutIcon)
	if withoutIcon.Icon != "Tag" || withoutIcon.Color != "#6b7280" {
		t.Fatalf("unexpected default response: %s", rec2.Body)
	}
}

func TestUpdateCategoryAppearance(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	h := NewServer(store.New(d), os.DirFS("."))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/categories", nil))
	var cats []struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	}
	json.Unmarshal(rec.Body.Bytes(), &cats)
	if len(cats) == 0 {
		t.Fatal("no seeded categories")
	}
	target := cats[0]

	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/categories/%d", target.ID),
		bytes.NewBufferString(`{"icon":"Zap","color":"#f59e0b"}`))
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req)
	if rec2.Code != 200 {
		t.Fatalf("update: %d %s", rec2.Code, rec2.Body)
	}
	var updated struct {
		Name  string `json:"name"`
		Icon  string `json:"icon"`
		Color string `json:"color"`
	}
	json.Unmarshal(rec2.Body.Bytes(), &updated)
	if updated.Name != target.Name || updated.Icon != "Zap" || updated.Color != "#f59e0b" {
		t.Fatalf("unexpected response: %s", rec2.Body)
	}

	// missing icon/color -> 400
	badReq := httptest.NewRequest("PUT", fmt.Sprintf("/api/categories/%d", target.ID),
		bytes.NewBufferString(`{}`))
	badRec := httptest.NewRecorder()
	h.ServeHTTP(badRec, badReq)
	if badRec.Code != 400 {
		t.Fatalf("want 400 for missing icon/color, got %d", badRec.Code)
	}
}
