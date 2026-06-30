package httpapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/sh-yazdipour/vibe-badget/internal/categorize"
)

func (s *Server) categorize(w http.ResponseWriter, r *http.Request) {
	res, err := s.runCategorize(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, res)
}

func (s *Server) runCategorize(ctx context.Context) (categorize.Result, error) {
	kv, err := s.store.GetSettings()
	if err != nil {
		return categorize.Result{}, err
	}
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
	return categorize.Run(ctx, s.store, llm, concurrency)
}
