package main

import (
	"embed"
	"io/fs"
)

//go:embed all:web/dist
var webDist embed.FS

// staticFS returns the built frontend rooted at web/dist.
func staticFS() fs.FS {
	sub, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		panic(err)
	}
	return sub
}
