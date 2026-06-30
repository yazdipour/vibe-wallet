package main

import (
	"log"
	"net/http"
	"os"

	"github.com/sh-yazdipour/vibe-badget/internal/db"
	"github.com/sh-yazdipour/vibe-badget/internal/httpapi"
	"github.com/sh-yazdipour/vibe-badget/internal/store"
)

func main() {
	path := os.Getenv("DB_PATH")
	if path == "" {
		path = "vibe-badget.db"
	}
	d, err := db.Open(path)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer d.Close()

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	h := httpapi.NewServer(store.New(d), nil, staticFS())
	log.Println("listening on", addr)
	log.Fatal(http.ListenAndServe(addr, h))
}
