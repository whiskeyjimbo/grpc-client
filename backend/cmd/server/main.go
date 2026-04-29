package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/whiskeyjimbo/grpc-client/backend/internal/api"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/definitions"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/execute"
	"github.com/whiskeyjimbo/grpc-client/backend/internal/store"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/grpcclient.db"
	}

	persistentStore, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("initialize sqlite store: %v", err)
	}
	defer func() {
		if closeErr := persistentStore.Close(); closeErr != nil {
			log.Printf("close sqlite store: %v", closeErr)
		}
	}()

	executor := execute.NewService()
	definitionsService := definitions.NewService()
	router := api.NewRouter(persistentStore, executor, definitionsService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      10 * time.Minute,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("grpc-client backend listening on :%s", port)
	if serveErr := srv.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		log.Fatalf("server error: %v", serveErr)
	}
}
