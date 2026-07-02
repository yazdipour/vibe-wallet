package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/sh-yazdipour/vibe-badget/internal/categorize"
)

func (s *Server) categorize(w http.ResponseWriter, r *http.Request) {
	kv, err := s.store.GetSettings()
	if err != nil {
		log.Printf("categorize: GetSettings failed: %v", err)
		http.Error(w, err.Error(), 500)
		return
	}
	llm, concurrency := buildClassifier(kv)

	log.Println("categorize: run starting")
	w.Header().Set("Content-Type", "application/x-ndjson")
	flusher, _ := w.(http.Flusher)
	enc := json.NewEncoder(w)

	onEntry := func(e categorize.LogEntry) {
		enc.Encode(e)
		if flusher != nil {
			flusher.Flush()
		}
	}

	res, err := categorize.Run(r.Context(), s.store, llm, concurrency, onEntry)
	if err != nil {
		log.Printf("categorize: run failed: %v", err)
		enc.Encode(map[string]any{"done": true, "error": err.Error()})
		if flusher != nil {
			flusher.Flush()
		}
		return
	}
	log.Printf("categorize: run complete — rules=%d llm=%d skipped=%d", res.Rules, res.LLM, res.Skipped)
	enc.Encode(map[string]any{
		"done": true, "rules": res.Rules, "llm": res.LLM, "skipped": res.Skipped,
	})
	if flusher != nil {
		flusher.Flush()
	}
}

func buildClassifier(kv map[string]string) (categorize.Classifier, int) {
	concurrency := 4
	if n, err := strconv.Atoi(kv["llm_concurrency"]); err == nil && n > 0 {
		concurrency = n
	}
	var llm categorize.Classifier
	if kv["llm_base_url"] != "" && kv["llm_model"] != "" {
		llm = categorize.NewLLM(categorize.LLMConfig{
			BaseURL: kv["llm_base_url"],
			APIKey:  kv["llm_api_key"],
			Model:   kv["llm_model"],
		})
	}
	return llm, concurrency
}
