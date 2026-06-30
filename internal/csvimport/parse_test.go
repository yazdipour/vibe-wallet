package csvimport

import (
	"strings"
	"testing"
)

const sample = `"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
2026-04-17,2026-04-17,"Main Account",,"Credit Transfer",Round-up,Emergency,0.8,,,
2026-04-21,2026-04-21,"LIDL DANKT",AT123,"Card Payment",Groceries,Main,-23.45,,,
`

func TestParse(t *testing.T) {
	txns, err := Parse(strings.NewReader(sample))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(txns) != 2 {
		t.Fatalf("want 2 txns, got %d", len(txns))
	}
	if txns[0].AccountName != "Emergency" || txns[0].AmountEUR != 0.8 {
		t.Fatalf("row0 mismatch: %+v", txns[0])
	}
	if txns[1].PartnerName != "LIDL DANKT" || txns[1].PartnerIban != "AT123" || txns[1].AmountEUR != -23.45 {
		t.Fatalf("row1 mismatch: %+v", txns[1])
	}
	if txns[0].DedupeHash == "" || txns[0].DedupeHash == txns[1].DedupeHash {
		t.Fatalf("dedupe hashes must be set and distinct")
	}
}

func TestParseRejectsWrongHeader(t *testing.T) {
	_, err := Parse(strings.NewReader("a,b,c\n1,2,3\n"))
	if err == nil {
		t.Fatal("want error on bad header, got nil")
	}
}
