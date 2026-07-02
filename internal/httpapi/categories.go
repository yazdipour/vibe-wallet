package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := s.store.ListCategories()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, cats)
}

func (s *Server) createCategory(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name      string `json:"name"`
		Icon      string `json:"icon"`
		Color     string `json:"color"`
		IconColor string `json:"icon_color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Name == "" {
		http.Error(w, "name required", 400)
		return
	}
	icon := in.Icon
	if icon == "" {
		icon = "Tag"
	}
	color := in.Color
	if color == "" {
		color = "#6b7280"
	}
	iconColor := in.IconColor
	if iconColor == "" {
		iconColor = "#ffffff"
	}
	c, err := s.store.CreateCategory(in.Name, icon, color, iconColor)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 201, c)
}

func (s *Server) updateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var in struct {
		Icon      string `json:"icon"`
		Color     string `json:"color"`
		IconColor string `json:"icon_color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Icon == "" || in.Color == "" || in.IconColor == "" {
		http.Error(w, "icon, color, and icon_color required", 400)
		return
	}
	c, err := s.store.UpdateCategoryAppearance(id, in.Icon, in.Color, in.IconColor)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, c)
}

func (s *Server) updateCategoryKind(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", 400)
		return
	}
	var in struct {
		Kind string `json:"kind"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || (in.Kind != "income" && in.Kind != "expense") {
		http.Error(w, "kind must be 'income' or 'expense'", 400)
		return
	}
	c, err := s.store.UpdateCategoryKind(id, in.Kind)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, c)
}
