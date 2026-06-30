package categorize

import (
	"context"
	"testing"

	"github.com/sh-yazdipour/vibe-badget/internal/db"
	"github.com/sh-yazdipour/vibe-badget/internal/model"
	"github.com/sh-yazdipour/vibe-badget/internal/store"
)

type fakeLLM struct{ called int }

func (f *fakeLLM) Classify(_ context.Context, partner string, _ []string) (string, error) {
	f.called++
	return "Transport", nil // pretend the model always says Transport
}

func TestRunRulesThenLLM(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	s := store.New(d)

	// Lidl seed rule -> Groceries handles row 1; row 2 has no rule -> LLM.
	_, err := s.InsertTransactions([]model.Transaction{
		{AccountName: "Main", PartnerName: "LIDL DANKT", DedupeHash: "a"},
		{AccountName: "Main", PartnerName: "Mystery Cab Co", DedupeHash: "b"},
	})
	if err != nil {
		t.Fatal(err)
	}

	f := &fakeLLM{}
	res, err := Run(context.Background(), s, f, 4)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if res.Rules != 1 || res.LLM != 1 || f.called != 1 {
		t.Fatalf("unexpected result %+v llmCalls=%d", res, f.called)
	}

	var remaining int
	d.QueryRow(`SELECT count(*) FROM transactions WHERE category_id IS NULL`).Scan(&remaining)
	if remaining != 0 {
		t.Fatalf("want 0 uncategorized, got %d", remaining)
	}
}
