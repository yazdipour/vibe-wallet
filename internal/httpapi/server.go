package httpapi

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"github.com/sh-yazdipour/vibe-badget/internal/store"
)

type Server struct {
	store *store.Store
	mux   *http.ServeMux
}

func NewServer(s *store.Store, static fs.FS) http.Handler {
	srv := &Server{store: s, mux: http.NewServeMux()}

	srv.mux.HandleFunc("GET /api/accounts", srv.listAccounts)
	srv.mux.HandleFunc("GET /api/transactions", srv.listTransactions)
	srv.mux.HandleFunc("POST /api/upload", srv.upload)
	srv.mux.HandleFunc("POST /api/categorize", srv.categorize)
	srv.mux.HandleFunc("GET /api/categories", srv.listCategories)
	srv.mux.HandleFunc("GET /api/rules", srv.listRules)
	srv.mux.HandleFunc("POST /api/rules", srv.createRule)
	srv.mux.HandleFunc("DELETE /api/rules/{id}", srv.deleteRule)
	srv.mux.HandleFunc("POST /api/categories", srv.createCategory)
	srv.mux.HandleFunc("PUT /api/categories/{id}", srv.updateCategory)
	srv.mux.HandleFunc("GET /api/settings", srv.getSettings)
	srv.mux.HandleFunc("PUT /api/settings", srv.putSettings)
	srv.mux.HandleFunc("GET /api/llm/health", srv.llmHealth)
	srv.mux.HandleFunc("PUT /api/transactions/{id}/category", srv.setTransactionCategory)

	// SPA: serve embedded files, fall back to index.html for client routes.
	srv.mux.Handle("/", spaHandler(static))
	return srv.mux
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func spaHandler(static fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(static))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := fs.Stat(static, r.URL.Path[1:]); err != nil && r.URL.Path != "/" {
			r.URL.Path = "/" // SPA fallback
		}
		fileServer.ServeHTTP(w, r)
	})
}
