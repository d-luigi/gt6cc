// Package api wires the HTTP routes to the cheats package.
package api

import (
	"encoding/json"
	"log"
	"net/http"

	"gta6cc/backend/internal/cheats"
)

type Config struct {
	// AllowedOrigin is the frontend origin allowed by CORS, e.g.
	// "http://localhost:5173". Empty disables CORS headers.
	AllowedOrigin string
}

type server struct {
	cheats *cheats.Repository
}

// New builds the full HTTP handler (routes + middleware).
func New(repo *cheats.Repository, cfg Config) http.Handler {
	s := &server{cheats: repo}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/cheats", s.listCheats)
	mux.HandleFunc("GET /api/cheats/{id}", s.getCheat)

	return withLogging(withCORS(cfg.AllowedOrigin, mux))
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) listCheats(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list := s.cheats.List(cheats.Filter{
		Platform:    q.Get("platform"),
		Category:    q.Get("category"),
		Subcategory: q.Get("subcategory"),
		Status:      q.Get("status"),
		Query:       q.Get("q"),
	})
	writeJSON(w, http.StatusOK, list)
}

func (s *server) getCheat(w http.ResponseWriter, r *http.Request) {
	c, ok := s.cheats.Get(r.PathValue("id"))
	if !ok {
		writeError(w, http.StatusNotFound, "cheat not found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
