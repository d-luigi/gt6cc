package comments

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

// Store is the only thing the HTTP layer knows about. To move to SQLite
// later, write a new type that satisfies this interface and change one
// line in main.go.
type Store interface {
	// List returns approved comments for a cheat, oldest first.
	List(ctx context.Context, cheatID string) ([]Comment, error)
	// Add saves a new comment and returns it with its ID filled in.
	Add(ctx context.Context, c Comment) (Comment, error)
}

// FileStore keeps all comments in memory and persists them to one JSON
// file. Fine for a prototype or low traffic; not for heavy write loads.
type FileStore struct {
	path string
	mu   sync.RWMutex
	data []Comment
}

func NewFileStore(path string) (*FileStore, error) {
	s := &FileStore{path: path}

	raw, err := os.ReadFile(path)
	switch {
	case errors.Is(err, os.ErrNotExist):
		// First run: start empty.
	case err != nil:
		return nil, fmt.Errorf("read %s: %w", path, err)
	case len(raw) > 0:
		if err := json.Unmarshal(raw, &s.data); err != nil {
			return nil, fmt.Errorf("parse %s: %w", path, err)
		}
	}
	return s, nil
}

func (s *FileStore) List(_ context.Context, cheatID string) ([]Comment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]Comment, 0)
	for _, c := range s.data {
		if c.CheatID == cheatID && c.Status == StatusApproved {
			out = append(out, c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out, nil
}

func (s *FileStore) Add(_ context.Context, c Comment) (Comment, error) {
	id, err := newID()
	if err != nil {
		return Comment{}, err
	}
	c.ID = id

	s.mu.Lock()
	defer s.mu.Unlock()

	next := append(append([]Comment(nil), s.data...), c)
	if err := writeAtomic(s.path, next); err != nil {
		return Comment{}, err
	}
	s.data = next
	return c, nil
}

func newID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// writeAtomic writes to a temp file and renames it, so a crash mid-write
// can never leave a half-written comments file.
func writeAtomic(path string, v any) error {
	raw, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, "comments-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return err
	}
	return os.Rename(tmpName, path)
}
