package store

import (
	"testing"

	"github.com/sh-yazdipour/vibe-badget/internal/db"
	"github.com/sh-yazdipour/vibe-badget/internal/model"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	t.Cleanup(func() { d.Close() })
	return New(d)
}

func TestInsertTransactionsIsIdempotent(t *testing.T) {
	s := newStore(t)
	txns := []model.Transaction{
		{AccountName: "Main", PartnerName: "LIDL", AmountEUR: -5, DedupeHash: "a"},
		{AccountName: "Main", PartnerName: "ALDI", AmountEUR: -9, DedupeHash: "b"},
	}
	n, err := s.InsertTransactions(txns)
	if err != nil || n != 2 {
		t.Fatalf("first insert: n=%d err=%v", n, err)
	}
	n, err = s.InsertTransactions(txns) // same rows again
	if err != nil || n != 0 {
		t.Fatalf("re-insert should be 0: n=%d err=%v", n, err)
	}
}

func TestCreateAndListCategoriesWithIconColor(t *testing.T) {
	s := newStore(t)

	c, err := s.CreateCategory("Pets", "PiggyBank", "#f59e0b", "#000000")
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}
	if c.Icon != "PiggyBank" || c.Color != "#f59e0b" || c.IconColor != "#000000" {
		t.Fatalf("unexpected created category: %+v", c)
	}

	cats, err := s.ListCategories()
	if err != nil {
		t.Fatalf("ListCategories: %v", err)
	}
	var found bool
	for _, cat := range cats {
		if cat.Name == "Pets" {
			found = true
			if cat.Icon != "PiggyBank" || cat.Color != "#f59e0b" || cat.IconColor != "#000000" {
				t.Fatalf("listed category mismatch: %+v", cat)
			}
		}
	}
	if !found {
		t.Fatal("Pets category not found in list")
	}

	// Re-creating with the same name upserts icon/color/icon_color instead of erroring.
	c2, err := s.CreateCategory("Pets", "Wallet", "#0ea5e9", "#ffffff")
	if err != nil {
		t.Fatalf("upsert CreateCategory: %v", err)
	}
	if c2.ID != c.ID || c2.Icon != "Wallet" || c2.Color != "#0ea5e9" || c2.IconColor != "#ffffff" {
		t.Fatalf("upsert did not update icon/color: %+v", c2)
	}
}

func TestUpdateCategoryAppearance(t *testing.T) {
	s := newStore(t)

	c, err := s.CreateCategory("Utilities2", "Tag", "#6b7280", "#ffffff")
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}

	updated, err := s.UpdateCategoryAppearance(c.ID, "Zap", "#f59e0b", "#000000")
	if err != nil {
		t.Fatalf("UpdateCategoryAppearance: %v", err)
	}
	if updated.ID != c.ID || updated.Name != "Utilities2" || updated.Icon != "Zap" || updated.Color != "#f59e0b" || updated.IconColor != "#000000" {
		t.Fatalf("unexpected updated category: %+v", updated)
	}

	cats, err := s.ListCategories()
	if err != nil {
		t.Fatalf("ListCategories: %v", err)
	}
	var found bool
	for _, cat := range cats {
		if cat.ID == c.ID {
			found = true
			if cat.Icon != "Zap" || cat.Color != "#f59e0b" || cat.IconColor != "#000000" {
				t.Fatalf("listed category not updated: %+v", cat)
			}
		}
	}
	if !found {
		t.Fatal("category not found after update")
	}
}

func TestDeleteTransaction(t *testing.T) {
	s := newStore(t)
	_, err := s.InsertTransactions([]model.Transaction{
		{AccountName: "Main", PartnerName: "LIDL", AmountEUR: -5, DedupeHash: "del-1"},
	})
	if err != nil {
		t.Fatal(err)
	}

	txns, err := s.ListTransactions(0)
	if err != nil || len(txns) != 1 {
		t.Fatalf("expected 1 transaction, got %d err=%v", len(txns), err)
	}
	id := txns[0].ID

	if err := s.DeleteTransaction(id); err != nil {
		t.Fatalf("DeleteTransaction: %v", err)
	}

	txns, err = s.ListTransactions(0)
	if err != nil || len(txns) != 0 {
		t.Fatalf("expected 0 transactions after delete, got %d err=%v", len(txns), err)
	}
}
