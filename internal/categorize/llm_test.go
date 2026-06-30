package categorize

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClassifySnapsToCategory(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{"message": map[string]string{"content": "  Groceries\n"}},
			},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	got, err := llm.Classify(context.Background(), "LIDL DANKT", []string{"Groceries", "Transport"})
	if err != nil || got != "Groceries" {
		t.Fatalf("got %q err %v", got, err)
	}
}

func TestClassifyUnknownFallsBack(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": "Spaceships"}}},
		})
	}))
	defer srv.Close()

	llm := NewLLM(LLMConfig{BaseURL: srv.URL, Model: "test"})
	got, _ := llm.Classify(context.Background(), "???", []string{"Groceries"})
	if got != "Uncategorized" {
		t.Fatalf("want Uncategorized, got %q", got)
	}
}
