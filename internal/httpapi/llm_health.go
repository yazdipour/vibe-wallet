package httpapi

import (
	"net/http"

	"github.com/sh-yazdipour/vibe-badget/internal/categorize"
)

func (s *Server) llmHealth(w http.ResponseWriter, r *http.Request) {
	kv, err := s.store.GetSettings()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if kv["llm_base_url"] == "" || kv["llm_model"] == "" {
		writeJSON(w, 200, categorize.PingResult{Status: "unconfigured", Message: "LLM not configured"})
		return
	}
	llm := categorize.NewLLM(categorize.LLMConfig{
		BaseURL: kv["llm_base_url"],
		APIKey:  kv["llm_api_key"],
		Model:   kv["llm_model"],
	})
	writeJSON(w, 200, llm.Ping(r.Context()))
}
