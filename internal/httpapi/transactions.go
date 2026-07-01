package httpapi

import (
	"net/http"
	"strconv"

	"github.com/sh-yazdipour/vibe-badget/internal/csvimport"
)

func (s *Server) listTransactions(w http.ResponseWriter, r *http.Request) {
	accountID, _ := strconv.ParseInt(r.URL.Query().Get("account_id"), 10, 64)
	txns, err := s.store.ListTransactions(accountID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, txns)
}

func (s *Server) deleteTransaction(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	if err := s.store.DeleteTransaction(id); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(16 << 20); err != nil { // 16 MB
		http.Error(w, "bad form", 400)
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file", 400)
		return
	}
	defer f.Close()

	txns, err := csvimport.Parse(f)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	n, err := s.store.InsertTransactions(txns)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, map[string]int{"inserted": n})
}
