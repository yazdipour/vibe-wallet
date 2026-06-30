// internal/httpapi/stubs.go — temporary; replaced in Task 7 & 8.
package httpapi

import "net/http"

func (s *Server) categorize(w http.ResponseWriter, r *http.Request)     { http.Error(w, "todo", 501) }
func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) { http.Error(w, "todo", 501) }
func (s *Server) listRules(w http.ResponseWriter, r *http.Request)      { http.Error(w, "todo", 501) }
func (s *Server) createRule(w http.ResponseWriter, r *http.Request)     { http.Error(w, "todo", 501) }
func (s *Server) deleteRule(w http.ResponseWriter, r *http.Request)     { http.Error(w, "todo", 501) }
func (s *Server) createCategory(w http.ResponseWriter, r *http.Request) { http.Error(w, "todo", 501) }
func (s *Server) getSettings(w http.ResponseWriter, r *http.Request)    { http.Error(w, "todo", 501) }
func (s *Server) putSettings(w http.ResponseWriter, r *http.Request)    { http.Error(w, "todo", 501) }
