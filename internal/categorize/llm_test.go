package categorize

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClassifyParsesCategoryAndReason(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": `{"category":"Groceries","reason":"LIDL is a supermarket chain"}`}},
			},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	cat, reason, err := llm.Classify(context.Background(), "LIDL DANKT", []string{"Groceries", "Transport"})
	if err != nil || cat != "Groceries" || reason != "LIDL is a supermarket chain" {
		t.Fatalf("got cat=%q reason=%q err=%v", cat, reason, err)
	}
}

func TestClassifyStripsMarkdownFences(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": "```json\n{\"category\":\"Transport\",\"reason\":\"taxi fare\"}\n```"}},
			},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	cat, reason, err := llm.Classify(context.Background(), "Taxi Co", []string{"Groceries", "Transport"})
	if err != nil || cat != "Transport" || reason != "taxi fare" {
		t.Fatalf("got cat=%q reason=%q err=%v", cat, reason, err)
	}
}

func TestClassifyFallsBackOnNonJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": "  Groceries\n"}}},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	cat, reason, err := llm.Classify(context.Background(), "LIDL DANKT", []string{"Groceries", "Transport"})
	if err != nil || cat != "Groceries" || reason != "" {
		t.Fatalf("got cat=%q reason=%q err=%v", cat, reason, err)
	}
}

func TestClassifyUnknownFallsBack(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": `{"category":"Spaceships","reason":"why not"}`}}},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	cat, _, err := llm.Classify(context.Background(), "???", []string{"Groceries"})
	if err != nil || cat != "Uncategorized" {
		t.Fatalf("want Uncategorized, got %q err %v", cat, err)
	}
}

func TestPingOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"id": "gemma3:12b"}, {"id": "llama3.1"}},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "gemma3:12b"})
	res := llm.Ping(context.Background())
	if res.Status != "ok" {
		t.Fatalf("want ok, got %+v", res)
	}
}

func TestPingModelNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"id": "llama3.1"}},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "gemma3:12b"})
	res := llm.Ping(context.Background())
	if res.Status != "model_not_found" {
		t.Fatalf("want model_not_found, got %+v", res)
	}
}

func TestPingUnreachable(t *testing.T) {
	llm := NewLLM(LLMConfig{BaseURL: "http://127.0.0.1:1", Model: "gemma3:12b"})
	res := llm.Ping(context.Background())
	if res.Status != "unreachable" {
		t.Fatalf("want unreachable, got %+v", res)
	}
}

func TestSuggestRulesParsesResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": `[{"pattern":"AMAZON","match_type":"keyword","category":"Shopping","reason":"varies per order"}]`}},
			},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	suggestions, err := llm.SuggestRules(context.Background(),
		[]PartnerCategory{{Partner: "AMAZON MKTP DE", Category: "Shopping"}},
		nil, []string{"Shopping", "Groceries"})
	if err != nil {
		t.Fatalf("SuggestRules: %v", err)
	}
	if len(suggestions) != 1 || suggestions[0].Pattern != "AMAZON" || suggestions[0].MatchType != "keyword" ||
		suggestions[0].Category != "Shopping" || suggestions[0].Reason != "varies per order" {
		t.Fatalf("unexpected suggestions: %+v", suggestions)
	}
}

func TestSuggestRulesDefaultsInvalidMatchType(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": `[{"pattern":"Lidl","match_type":"fuzzy","category":"Groceries","reason":"x"}]`}},
			},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	suggestions, err := llm.SuggestRules(context.Background(),
		[]PartnerCategory{{Partner: "Lidl", Category: "Groceries"}}, nil, []string{"Groceries"})
	if err != nil {
		t.Fatalf("SuggestRules: %v", err)
	}
	if len(suggestions) != 1 || suggestions[0].MatchType != "keyword" {
		t.Fatalf("expected match_type to default to keyword: %+v", suggestions)
	}
}

func TestSuggestRulesDropsUnknownCategory(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": `[
					{"pattern":"Lidl","match_type":"exact","category":"Groceries","reason":"x"},
					{"pattern":"Ghost","match_type":"exact","category":"NotARealCategory","reason":"y"}
				]`}},
			},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	suggestions, err := llm.SuggestRules(context.Background(),
		[]PartnerCategory{{Partner: "Lidl", Category: "Groceries"}, {Partner: "Ghost", Category: "NotARealCategory"}},
		nil, []string{"Groceries"})
	if err != nil {
		t.Fatalf("SuggestRules: %v", err)
	}
	if len(suggestions) != 1 || suggestions[0].Pattern != "Lidl" {
		t.Fatalf("expected only the known-category suggestion to survive: %+v", suggestions)
	}
}
