package db

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestOpenSeedsDefaults(t *testing.T) {
	d, err := Open(":memory:")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer d.Close()

	var cats int
	if err := d.QueryRow(`SELECT count(*) FROM categories`).Scan(&cats); err != nil {
		t.Fatalf("count categories: %v", err)
	}
	if cats < 5 {
		t.Fatalf("want >=5 seeded categories, got %d", cats)
	}

	var lidl int
	err = d.QueryRow(`SELECT count(*) FROM rules WHERE pattern='Lidl'`).Scan(&lidl)
	if err != nil || lidl != 1 {
		t.Fatalf("want 1 Lidl rule, got %d err %v", lidl, err)
	}
}

func TestOpenMigratesCategoryColumns(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")

	// Simulate a pre-existing database whose categories table predates
	// icon/color (the shape the live container currently has).
	oldDB, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`CREATE TABLE categories (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`INSERT INTO categories(name) VALUES('Legacy')`); err != nil {
		t.Fatal(err)
	}
	oldDB.Close()

	d, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	var icon, color string
	if err := d.QueryRow(`SELECT icon,color FROM categories WHERE name='Legacy'`).Scan(&icon, &color); err != nil {
		t.Fatalf("query migrated row: %v", err)
	}
	if icon != "Tag" || color != "#6b7280" {
		t.Fatalf("want defaults Tag/#6b7280, got icon=%q color=%q", icon, color)
	}
	d.Close()

	// Open() again must be idempotent — no error re-adding existing columns.
	d2, err := Open(path)
	if err != nil {
		t.Fatalf("second Open: %v", err)
	}
	d2.Close()
}
