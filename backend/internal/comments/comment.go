// Package comments holds the comment model, validation and storage.
package comments

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

type Status string

const (
	StatusApproved Status = "approved"
	StatusPending  Status = "pending"
)

type Comment struct {
	ID        string    `json:"id"`
	CheatID   string    `json:"cheatId"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	Status    Status    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// Input is what the client sends when posting a comment.
// Website is a honeypot: real users never see or fill it.
type Input struct {
	Author  string `json:"author"`
	Body    string `json:"body"`
	Website string `json:"website"`
}

const (
	maxAuthorLen = 40
	maxBodyLen   = 1000
)

// Clean trims the input and checks the length limits.
func (in *Input) Clean() error {
	in.Author = strings.TrimSpace(in.Author)
	in.Body = strings.TrimSpace(in.Body)

	if in.Author == "" {
		in.Author = "Anonymous"
	}
	if utf8.RuneCountInString(in.Author) > maxAuthorLen {
		return errors.New("name is too long (max 40 characters)")
	}
	if in.Body == "" {
		return errors.New("comment cannot be empty")
	}
	if utf8.RuneCountInString(in.Body) > maxBodyLen {
		return errors.New("comment is too long (max 1000 characters)")
	}
	return nil
}
