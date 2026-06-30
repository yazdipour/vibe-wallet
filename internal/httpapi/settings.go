package httpapi

import (
	"encoding/json"
	"net/http"
)

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	kv, err := s.store.GetSettings()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if kv["llm_api_key"] != "" {
		kv["llm_api_key_set"] = "true"
		delete(kv, "llm_api_key") // never echo the secret back
	}
	writeJSON(w, 200, kv)
}

func (s *Server) putSettings(w http.ResponseWriter, r *http.Request) {
	var kv map[string]string
	if err := json.NewDecoder(r.Body).Decode(&kv); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	// don't overwrite the stored key with an empty string from the masked form
	if v, ok := kv["llm_api_key"]; ok && v == "" {
		delete(kv, "llm_api_key")
	}
	if err := s.store.PutSettings(kv); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}
