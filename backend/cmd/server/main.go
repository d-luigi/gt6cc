package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gta6cc/backend/internal/api"
	"gta6cc/backend/internal/cheats"
)

func main() {
	port := env("PORT", "8080")
	allowedOrigin := env("ALLOWED_ORIGIN", "http://localhost:5173")

	repo, err := cheats.Load()
	if err != nil {
		log.Fatalf("load cheats: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           api.New(repo, api.Config{AllowedOrigin: allowedOrigin}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("gta6cc backend listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
