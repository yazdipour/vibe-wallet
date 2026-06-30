package csvimport

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/sh-yazdipour/vibe-badget/internal/model"
)

var header = []string{
	"Booking Date", "Value Date", "Partner Name", "Partner Iban", "Type",
	"Payment Reference", "Account Name", "Amount (EUR)", "Original Amount",
	"Original Currency", "Exchange Rate",
}

// Parse reads the bank CSV and returns one Transaction per data row.
func Parse(r io.Reader) ([]model.Transaction, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = len(header)

	head, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}
	for i, h := range header {
		if strings.TrimSpace(head[i]) != h {
			return nil, fmt.Errorf("unexpected header at col %d: got %q want %q", i, head[i], h)
		}
	}

	var out []model.Transaction
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read row: %w", err)
		}
		t := model.Transaction{
			BookingDate:      rec[0],
			ValueDate:        rec[1],
			PartnerName:      rec[2],
			PartnerIban:      rec[3],
			Type:             rec[4],
			PaymentReference: rec[5],
			AccountName:      rec[6],
			AmountEUR:        atof(rec[7]),
			OriginalAmount:   atofPtr(rec[8]),
			OriginalCurrency: rec[9],
			ExchangeRate:     atofPtr(rec[10]),
		}
		t.DedupeHash = hashRow(rec)
		out = append(out, t)
	}
	return out, nil
}

func atof(s string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f
}

func atofPtr(s string) *float64 {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	f := atof(s)
	return &f
}

func hashRow(rec []string) string {
	sum := sha256.Sum256([]byte(strings.Join(rec, "\x1f")))
	return hex.EncodeToString(sum[:])
}
