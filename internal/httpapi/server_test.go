package httpapi

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/sh-yazdipour/vibe-badget/internal/db"
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

	// categorize with no LLM still applies rules and returns 200
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/categorize", nil))
	if rec2.Code != 200 {
		t.Fatalf("categorize: %d %s", rec2.Code, rec2.Body)
	}
}
