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

var nativeHeader = []string{"Date", "Partner", "Reference", "Amount", "Category", "Account"}

// Parse reads either the bank CSV format or the app's own native export
// format and returns one Transaction per data row.
func Parse(r io.Reader) ([]model.Transaction, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1 // header shape isn't known yet; validated manually below

	head, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	if headerMatches(head, nativeHeader) {
		return parseNative(cr)
	}
	if headerMatches(head, header) {
		return parseBank(cr)
	}
	return nil, fmt.Errorf("unrecognized CSV header: %v", head)
}

func headerMatches(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i, w := range want {
		if strings.TrimSpace(got[i]) != w {
			return false
		}
	}
	return true
}

func parseBank(cr *csv.Reader) ([]model.Transaction, error) {
	var out []model.Transaction
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read row: %w", err)
		}
		if len(rec) != len(header) {
			return nil, fmt.Errorf("expected %d columns, got %d", len(header), len(rec))
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

func parseNative(cr *csv.Reader) ([]model.Transaction, error) {
	var out []model.Transaction
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read row: %w", err)
		}
		if len(rec) != len(nativeHeader) {
			return nil, fmt.Errorf("expected %d columns, got %d", len(nativeHeader), len(rec))
		}
		t := model.Transaction{
			BookingDate:      rec[0],
			PartnerName:      rec[1],
			PaymentReference: rec[2],
			AmountEUR:        atof(rec[3]),
			Category:         rec[4],
			AccountName:      rec[5],
		}
		t.DedupeHash = hashNative(t.AccountName, t.BookingDate, t.PartnerName, t.AmountEUR, t.PaymentReference)
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

// hashNative computes a content-based dedupe hash for native-format rows,
// stable across repeated parses of the same exported file (unlike hashRow,
// which hashes raw CSV bytes and would differ between the two formats for
// what is conceptually the same transaction).
func hashNative(account, bookingDate, partner string, amount float64, reference string) string {
	key := strings.Join([]string{account, bookingDate, partner, strconv.FormatFloat(amount, 'f', 2, 64), reference}, "\x1f")
	sum := sha256.Sum256([]byte("native\x1f" + key))
	return hex.EncodeToString(sum[:])
}
