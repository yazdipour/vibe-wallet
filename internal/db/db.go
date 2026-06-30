package db

import (
	"database/sql"
	_ "embed"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

//go:embed seed.sql
var seedSQL string

// execScript splits sql on semicolons and runs each non-empty statement.
// Lines beginning with -- are stripped before execution.
func execScript(d *sql.DB, script string) error {
	for _, stmt := range strings.Split(script, ";") {
		// Strip comment lines, keeping the SQL lines.
		var lines []string
		for _, line := range strings.Split(stmt, "\n") {
			if !strings.HasPrefix(strings.TrimSpace(line), "--") {
				lines = append(lines, line)
			}
		}
		stmt = strings.TrimSpace(strings.Join(lines, "\n"))
		if stmt == "" {
			continue
		}
		if _, err := d.Exec(stmt); err != nil {
			return fmt.Errorf("stmt %q: %w", stmt[:min(80, len(stmt))], err)
		}
	}
	return nil
}

// Open opens (or creates) the SQLite database, applies the schema and seed
// data, and returns a ready connection. Use ":memory:" in tests.
func Open(path string) (*sql.DB, error) {
	d, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	d.SetMaxOpenConns(1)
	for _, pragma := range []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
	} {
		if _, err := d.Exec(pragma); err != nil {
			d.Close()
			return nil, err
		}
	}
	if err := execScript(d, schemaSQL); err != nil {
		d.Close()
		return nil, err
	}
	if err := execScript(d, seedSQL); err != nil {
		d.Close()
		return nil, err
	}
	return d, nil
}
