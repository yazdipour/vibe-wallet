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

// migrateCategoryColumns adds icon/color columns to a categories table that
// predates them (the shape any pre-existing database has). It's a no-op if
// the columns already exist, so it's safe to call on every Open().
func migrateCategoryColumns(d *sql.DB) error {
	rows, err := d.Query(`PRAGMA table_info(categories)`)
	if err != nil {
		return err
	}
	existing := map[string]bool{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		existing[name] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()

	if !existing["icon"] {
		if _, err := d.Exec(`ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'Tag'`); err != nil {
			return err
		}
	}
	if !existing["color"] {
		if _, err := d.Exec(`ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#6b7280'`); err != nil {
			return err
		}
	}
	if !existing["icon_color"] {
		if _, err := d.Exec(`ALTER TABLE categories ADD COLUMN icon_color TEXT NOT NULL DEFAULT '#ffffff'`); err != nil {
			return err
		}
	}
	return nil
}

// migrateCategoryKind adds an income/expense `kind` column to a categories
// table that predates it, and — only at the moment the column is first
// added — seeds each category's kind from its transaction history (net
// positive amount -> income, net negative or no transactions -> expense).
// After this one-time seed, kind is fully explicit and never recomputed,
// so a user's manual drag-and-drop choice always survives a restart.
func migrateCategoryKind(d *sql.DB) error {
	rows, err := d.Query(`PRAGMA table_info(categories)`)
	if err != nil {
		return err
	}
	hasKind := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == "kind" {
			hasKind = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()

	if hasKind {
		return nil
	}

	if _, err := d.Exec(`ALTER TABLE categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense' CHECK(kind IN ('income','expense'))`); err != nil {
		return err
	}
	_, err = d.Exec(`
		UPDATE categories SET kind = 'income'
		WHERE id IN (
			SELECT category_id FROM transactions
			WHERE category_id IS NOT NULL
			GROUP BY category_id
			HAVING SUM(amount_eur) > 0
		)
	`)
	return err
}

// defaultSeedRules are the example keyword rules (pattern, category name)
// that used to ship in seed.sql before it was pruned down to just Lidl.
var defaultSeedRules = []struct{ pattern, category string }{
	{"Aldi", "Groceries"}, {"Hofer", "Groceries"}, {"Billa", "Groceries"}, {"Spar", "Groceries"}, {"Penny", "Groceries"},
	{"McDonald", "Eating Out"}, {"Starbucks", "Eating Out"},
	{"Uber", "Transport"}, {"OEBB", "Transport"}, {"Wiener Linien", "Transport"},
	{"Amazon", "Shopping"}, {"IKEA", "Shopping"},
	{"Netflix", "Entertainment"}, {"Spotify", "Entertainment"},
	{"A1", "Bills & Utilities"}, {"Magenta", "Bills & Utilities"},
}

// migratePruneDefaultSeedRules deletes the pre-set example rules that used
// to ship in seed.sql, keeping only Lidl. Runs exactly once, guarded by a
// settings marker, so a user who later re-adds one of these exact
// pattern+category combinations never has it silently removed again on a
// future restart. Matching on category (not just pattern) means a user's
// own rule that happens to share a pruned pattern's text on a different
// category is left untouched.
func migratePruneDefaultSeedRules(d *sql.DB) error {
	var marker string
	err := d.QueryRow(`SELECT value FROM settings WHERE key='default_rules_pruned_v1'`).Scan(&marker)
	if err == nil {
		return nil // already ran
	}
	if err != sql.ErrNoRows {
		return err
	}

	for _, r := range defaultSeedRules {
		if _, err := d.Exec(`
			DELETE FROM rules WHERE field='partner_name' AND match_type='keyword' AND pattern=?
			AND category_id IN (SELECT id FROM categories WHERE name=?)`,
			r.pattern, r.category,
		); err != nil {
			return err
		}
	}
	_, err = d.Exec(`INSERT INTO settings (key, value) VALUES ('default_rules_pruned_v1', 'true')`)
	return err
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
	if err := migrateCategoryColumns(d); err != nil {
		d.Close()
		return nil, err
	}
	if err := migrateCategoryKind(d); err != nil {
		d.Close()
		return nil, err
	}
	if err := execScript(d, seedSQL); err != nil {
		d.Close()
		return nil, err
	}
	if err := migratePruneDefaultSeedRules(d); err != nil {
		d.Close()
		return nil, err
	}
	return d, nil
}
