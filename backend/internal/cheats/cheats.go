// Package cheats loads the cheat list (embedded in the binary) and serves
// read-only queries over it.
package cheats

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed data/cheats.json
var dataFS embed.FS

type Cheat struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Category    string   `json:"category"`
	Subcategory string   `json:"subcategory"`
	Description string   `json:"description"`
	Unlock      string   `json:"unlock"`
	Input       []string `json:"input"` // D-pad sequence; empty until discovered
	Discovered  bool     `json:"discovered"`
	Platforms   []string `json:"platforms"`
}

// Filter holds optional query parameters. Empty fields match everything.
type Filter struct {
	Platform    string
	Category    string
	Subcategory string
	Status      string // "discovered" or "undiscovered"
	Query       string
}

type Repository struct {
	cheats []Cheat
	byID   map[string]Cheat
}

// Load reads the embedded cheats.json once. Call at startup.
func Load() (*Repository, error) {
	raw, err := dataFS.ReadFile("data/cheats.json")
	if err != nil {
		return nil, fmt.Errorf("read cheats.json: %w", err)
	}
	var list []Cheat
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("parse cheats.json: %w", err)
	}
	byID := make(map[string]Cheat, len(list))
	for _, c := range list {
		if c.ID == "" {
			return nil, fmt.Errorf("cheat %q has no id", c.Title)
		}
		if _, dup := byID[c.ID]; dup {
			return nil, fmt.Errorf("duplicate cheat id %q", c.ID)
		}
		byID[c.ID] = c
	}
	return &Repository{cheats: list, byID: byID}, nil
}

func (r *Repository) Get(id string) (Cheat, bool) {
	c, ok := r.byID[id]
	return c, ok
}

func (r *Repository) List(f Filter) []Cheat {
	platform := strings.ToLower(strings.TrimSpace(f.Platform))
	category := strings.ToLower(strings.TrimSpace(f.Category))
	sub := strings.ToLower(strings.TrimSpace(f.Subcategory))
	status := strings.ToLower(strings.TrimSpace(f.Status))
	q := strings.ToLower(strings.TrimSpace(f.Query))

	out := make([]Cheat, 0, len(r.cheats))
	for _, c := range r.cheats {
		if category != "" && strings.ToLower(c.Category) != category {
			continue
		}
		if sub != "" && strings.ToLower(c.Subcategory) != sub {
			continue
		}
		if status == "discovered" && !c.Discovered {
			continue
		}
		if status == "undiscovered" && c.Discovered {
			continue
		}
		if platform != "" && !hasPlatform(c.Platforms, platform) {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(c.Title+" "+c.Description+" "+c.Unlock), q) {
			continue
		}
		out = append(out, c)
	}
	return out
}

func hasPlatform(platforms []string, want string) bool {
	for _, p := range platforms {
		if strings.ToLower(p) == want {
			return true
		}
	}
	return false
}
