// Package api wires the HTTP routes to the cheats and comments packages.
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"gta6cc/backend/internal/cheats"
	"gta6cc/backend/internal/comments"
)

type Config struct {
	// AllowedOrigin is the frontend origin allowed by CORS, e.g.
	// "http://localhost:5173". Empty disables CORS headers.
	AllowedOrigin string
	// RequireApproval stores new comments as pending instead of showing
	// them straight away.
	RequireApproval bool
}

type server struct {
	cheats          *cheats.Repository
	comments        comments.Store
	requireApproval bool
	limiter         *rateLimiter
}

// New builds the full HTTP handler (routes + middleware).
func New(repo *cheats.Repository, store comments.Store, cfg Config) http.Handler {
	s := &server{
		cheats:          repo,
		comments:        store,
		requireApproval: cfg.RequireApproval,
		// 5 comments per IP per minute.
		limiter: newRateLimiter(5, time.Minute),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/cheats", s.listCheats)
	mux.HandleFunc("GET /api/cheats/{id}", s.getCheat)
	mux.HandleFunc("GET /api/cheats/{id}/comments", s.listComments)
	mux.HandleFunc("POST /api/cheats/{id}/comments", s.addComment)

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

func (s *server) listComments(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := s.cheats.Get(id); !ok {
		writeError(w, http.StatusNotFound, "cheat not found")
		return
	}
	list, err := s.comments.List(r.Context(), id)
	if err != nil {
		log.Printf("list comments: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load comments")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) addComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := s.cheats.Get(id); !ok {
		writeError(w, http.StatusNotFound, "cheat not found")
		return
	}

	if !s.limiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too many comments, try again in a minute")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4<<10) // 4 KB is plenty
	var in comments.Input
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Honeypot: bots fill every field. Pretend it worked, store nothing.
	if in.Website != "" {
		writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
		return
	}

	if err := in.Clean(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	status := comments.StatusApproved
	if s.requireApproval {
		status = comments.StatusPending
	}

	saved, err := s.comments.Add(r.Context(), comments.Comment{
		CheatID:   id,
		Author:    in.Author,
		Body:      in.Body,
		Status:    status,
		CreatedAt: time.Now().UTC(),
	})
	if err != nil {
		log.Printf("add comment: %v", err)
		writeError(w, http.StatusInternalServerError, "could not save comment")
		return
	}

	if status == comments.StatusPending {
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "pending approval"})
		return
	}
	writeJSON(w, http.StatusCreated, saved)
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
