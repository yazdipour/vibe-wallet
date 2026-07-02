package httpapi

import (
	"log"
	"net/http"
	"strconv"
	"strings"

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

	log.Println("upload: parsing CSV")
	txns, err := csvimport.Parse(f)
	if err != nil {
		log.Printf("upload: parse failed: %v", err)
		http.Error(w, err.Error(), 400)
		return
	}

	cats, err := s.store.ListCategories()
	if err != nil {
		log.Printf("upload: ListCategories failed: %v", err)
		http.Error(w, err.Error(), 500)
		return
	}
	catByName := map[string]int64{}
	for _, c := range cats {
		catByName[strings.ToLower(c.Name)] = c.ID
	}

	toInsert := txns[:0]
	skipped := 0
	for _, t := range txns {
		if t.Category != "" {
			id, ok := catByName[strings.ToLower(t.Category)]
			if !ok {
				skipped++
				continue
			}
			t.CategoryID = &id
			t.CategorizedBy = "import"
		}
		toInsert = append(toInsert, t)
	}

	n, err := s.store.InsertTransactions(toInsert)
	if err != nil {
		log.Printf("upload: InsertTransactions failed: %v", err)
		http.Error(w, err.Error(), 500)
		return
	}
	log.Printf("upload: inserted %d, skipped %d (unknown category)", n, skipped)
	writeJSON(w, 200, map[string]int{"inserted": n, "skipped_unknown_category": skipped})
}
