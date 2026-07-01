package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func (s *Server) setTransactionCategory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var in struct {
		CategoryID int64 `json:"category_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.CategoryID == 0 {
		http.Error(w, "category_id required", 400)
		return
	}
	if err := s.store.SetCategory(id, in.CategoryID, "manual"); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}
