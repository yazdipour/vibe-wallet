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

func TestOpenSeedsIncomeCategoriesOnFreshDatabase(t *testing.T) {
	d, err := Open(":memory:")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer d.Close()

	var incomeKind, savingsKind string
	if err := d.QueryRow(`SELECT kind FROM categories WHERE name='Income'`).Scan(&incomeKind); err != nil {
		t.Fatalf("query Income kind: %v", err)
	}
	if err := d.QueryRow(`SELECT kind FROM categories WHERE name='Savings'`).Scan(&savingsKind); err != nil {
		t.Fatalf("query Savings kind: %v", err)
	}
	if incomeKind != "income" {
		t.Fatalf("want Income category seeded with kind='income', got %q", incomeKind)
	}
	if savingsKind != "income" {
		t.Fatalf("want Savings category seeded with kind='income', got %q", savingsKind)
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

func TestOpenMigratesCategoryKindInfersFromTransactions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old-kind.db")

	// Simulate a pre-existing database whose categories table predates
	// `kind`, with two categories and transactions establishing a clear
	// net-positive (income) and net-negative (expense) history.
	oldDB, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`CREATE TABLE categories (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		icon TEXT NOT NULL DEFAULT 'Tag',
		color TEXT NOT NULL DEFAULT '#6b7280',
		icon_color TEXT NOT NULL DEFAULT '#ffffff',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`CREATE TABLE accounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`CREATE TABLE transactions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		account_id INTEGER NOT NULL,
		category_id INTEGER,
		amount_eur REAL NOT NULL,
		booking_date TEXT NOT NULL DEFAULT '',
		partner_name TEXT NOT NULL DEFAULT '',
		dedupe_hash TEXT NOT NULL DEFAULT ''
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`INSERT INTO categories(id,name) VALUES(1,'Salary'),(2,'Groceries')`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`INSERT INTO accounts(id,name) VALUES(1,'Main')`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`INSERT INTO transactions(account_id,category_id,amount_eur,dedupe_hash) VALUES
		(1,1,2000,'a'), (1,2,-50,'b'), (1,2,-30,'c')`); err != nil {
		t.Fatal(err)
	}
	oldDB.Close()

	d, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	var salaryKind, groceriesKind string
	if err := d.QueryRow(`SELECT kind FROM categories WHERE name='Salary'`).Scan(&salaryKind); err != nil {
		t.Fatalf("query Salary kind: %v", err)
	}
	if err := d.QueryRow(`SELECT kind FROM categories WHERE name='Groceries'`).Scan(&groceriesKind); err != nil {
		t.Fatalf("query Groceries kind: %v", err)
	}
	if salaryKind != "income" {
		t.Fatalf("want Salary inferred as income (net +2000), got %q", salaryKind)
	}
	if groceriesKind != "expense" {
		t.Fatalf("want Groceries inferred as expense (net -80), got %q", groceriesKind)
	}
	d.Close()

	// Manually flip Groceries to income, then reopen — the migration must
	// NOT re-run its seed and stomp the user's manual choice.
	d2, err := Open(path)
	if err != nil {
		t.Fatalf("second Open: %v", err)
	}
	if _, err := d2.Exec(`UPDATE categories SET kind='income' WHERE name='Groceries'`); err != nil {
		t.Fatal(err)
	}
	d2.Close()

	d3, err := Open(path)
	if err != nil {
		t.Fatalf("third Open: %v", err)
	}
	defer d3.Close()
	var groceriesKindAfter string
	if err := d3.QueryRow(`SELECT kind FROM categories WHERE name='Groceries'`).Scan(&groceriesKindAfter); err != nil {
		t.Fatalf("query Groceries kind after manual edit: %v", err)
	}
	if groceriesKindAfter != "income" {
		t.Fatalf("manual kind edit must survive reopening, got %q", groceriesKindAfter)
	}
}

func TestOpenPrunesDefaultSeedRulesKeepingOnlyLidl(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old-rules.db")

	// Simulate a pre-existing database seeded before the default rules were
	// pruned down to just Lidl (the shape any pre-existing container has).
	// Built with raw schema + manual inserts (not this package's Open()) so
	// the one-time prune marker is NOT set yet when the real Open() below
	// runs for the first time against this data.
	oldDB, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if err := execScript(oldDB, schemaSQL); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`INSERT INTO categories (name, kind) VALUES ('Groceries','expense'), ('Eating Out','expense')`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`
		INSERT INTO rules (field, match_type, pattern, category_id)
		SELECT 'partner_name', 'keyword', 'Lidl', id FROM categories WHERE name='Groceries'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`
		INSERT INTO rules (field, match_type, pattern, category_id)
		SELECT 'partner_name', 'keyword', 'Aldi', id FROM categories WHERE name='Groceries'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := oldDB.Exec(`
		INSERT INTO rules (field, match_type, pattern, category_id)
		SELECT 'partner_name', 'keyword', 'Starbucks', id FROM categories WHERE name='Eating Out'
	`); err != nil {
		t.Fatal(err)
	}
	// A user-created rule sharing a pattern name with a pruned default, but
	// on a category that was never seeded that way — must survive.
	if _, err := oldDB.Exec(`
		INSERT INTO rules (field, match_type, pattern, category_id)
		SELECT 'partner_name', 'keyword', 'Netflix', id FROM categories WHERE name='Groceries'
	`); err != nil {
		t.Fatal(err)
	}
	oldDB.Close()

	d, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer d.Close()

	var aldiCount, starbucksCount, lidlCount, userNetflixCount int
	d.QueryRow(`SELECT count(*) FROM rules WHERE pattern='Aldi'`).Scan(&aldiCount)
	d.QueryRow(`SELECT count(*) FROM rules WHERE pattern='Starbucks'`).Scan(&starbucksCount)
	d.QueryRow(`SELECT count(*) FROM rules WHERE pattern='Lidl'`).Scan(&lidlCount)
	d.QueryRow(`
		SELECT count(*) FROM rules r JOIN categories c ON r.category_id=c.id
		WHERE r.pattern='Netflix' AND c.name='Groceries'
	`).Scan(&userNetflixCount)

	if aldiCount != 0 {
		t.Fatalf("want Aldi rule pruned, found %d", aldiCount)
	}
	if starbucksCount != 0 {
		t.Fatalf("want Starbucks rule pruned, found %d", starbucksCount)
	}
	if lidlCount != 1 {
		t.Fatalf("want Lidl rule kept, found %d", lidlCount)
	}
	if userNetflixCount != 1 {
		t.Fatalf("a rule sharing a pruned pattern name on a different category must survive, found %d", userNetflixCount)
	}

	// Re-adding a pruned pattern after cleanup must survive future restarts
	// (the prune is one-time, not a standing filter).
	if _, err := d.Exec(`
		INSERT INTO rules (field, match_type, pattern, category_id)
		SELECT 'partner_name', 'keyword', 'Aldi', id FROM categories WHERE name='Groceries'
	`); err != nil {
		t.Fatal(err)
	}
	d.Close()

	d2, err := Open(path)
	if err != nil {
		t.Fatalf("third Open: %v", err)
	}
	defer d2.Close()
	var aldiCountAfter int
	d2.QueryRow(`SELECT count(*) FROM rules WHERE pattern='Aldi'`).Scan(&aldiCountAfter)
	if aldiCountAfter != 1 {
		t.Fatalf("re-added rule must survive future restarts, found %d", aldiCountAfter)
	}
}
