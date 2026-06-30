package store

import (
	"database/sql"

	"github.com/sh-yazdipour/vibe-badget/internal/model"
)

type Store struct{ db *sql.DB }

func New(d *sql.DB) *Store { return &Store{db: d} }

func (s *Store) UpsertAccount(name string) (int64, error) {
	if _, err := s.db.Exec(`INSERT OR IGNORE INTO accounts(name) VALUES(?)`, name); err != nil {
		return 0, err
	}
	var id int64
	err := s.db.QueryRow(`SELECT id FROM accounts WHERE name=?`, name).Scan(&id)
	return id, err
}

func (s *Store) ActiveRules() ([]model.Rule, error) {
	rows, err := s.db.Query(`SELECT id,field,match_type,pattern,category_id FROM rules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Rule
	for rows.Next() {
		var r model.Rule
		if err := rows.Scan(&r.ID, &r.Field, &r.MatchType, &r.Pattern, &r.CategoryID); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) UncategorizedTransactions() ([]model.Transaction, error) {
	rows, err := s.db.Query(`SELECT id,partner_name,partner_iban,type,payment_reference
		FROM transactions WHERE category_id IS NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Transaction
	for rows.Next() {
		var t model.Transaction
		if err := rows.Scan(&t.ID, &t.PartnerName, &t.PartnerIban, &t.Type, &t.PaymentReference); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) CategoryNames() (map[string]int64, []string, error) {
	rows, err := s.db.Query(`SELECT id,name FROM categories ORDER BY name`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	byName := map[string]int64{}
	var names []string
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, nil, err
		}
		byName[name] = id
		names = append(names, name)
	}
	return byName, names, rows.Err()
}

func (s *Store) SetCategory(txID, categoryID int64, by string) error {
	_, err := s.db.Exec(`UPDATE transactions SET category_id=?, categorized_by=? WHERE id=?`,
		categoryID, by, txID)
	return err
}

func (s *Store) ListAccounts() ([]model.Account, error) {
	rows, err := s.db.Query(`SELECT id,name FROM accounts ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Account
	for rows.Next() {
		var a model.Account
		if err := rows.Scan(&a.ID, &a.Name); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListTransactions returns transactions for an account (0 = all), newest first.
func (s *Store) ListTransactions(accountID int64) ([]model.Transaction, error) {
	q := `SELECT t.id,t.account_id,t.booking_date,t.partner_name,t.partner_iban,
	       t.type,t.payment_reference,t.amount_eur,
	       COALESCE(t.categorized_by,''),COALESCE(c.name,'')
	      FROM transactions t LEFT JOIN categories c ON c.id=t.category_id`
	args := []any{}
	if accountID > 0 {
		q += ` WHERE t.account_id=?`
		args = append(args, accountID)
	}
	q += ` ORDER BY t.booking_date DESC, t.id DESC`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Transaction
	for rows.Next() {
		var t model.Transaction
		var catName string
		if err := rows.Scan(&t.ID, &t.AccountID, &t.BookingDate, &t.PartnerName,
			&t.PartnerIban, &t.Type, &t.PaymentReference, &t.AmountEUR,
			&t.CategorizedBy, &catName); err != nil {
			return nil, err
		}
		t.AccountName = catName // reuse: stash category name for the API row
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) InsertTransactions(txns []model.Transaction) (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	accIDs := map[string]int64{}
	inserted := 0
	for _, t := range txns {
		id, ok := accIDs[t.AccountName]
		if !ok {
			if err := tx.QueryRow(`INSERT INTO accounts(name) VALUES(?)
				ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id`, t.AccountName).Scan(&id); err != nil {
				return 0, err
			}
			accIDs[t.AccountName] = id
		}
		res, err := tx.Exec(`INSERT OR IGNORE INTO transactions
			(account_id,booking_date,value_date,partner_name,partner_iban,type,
			 payment_reference,amount_eur,original_amount,original_currency,exchange_rate,dedupe_hash)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, t.BookingDate, t.ValueDate, t.PartnerName, t.PartnerIban, t.Type,
			t.PaymentReference, t.AmountEUR, t.OriginalAmount, t.OriginalCurrency, t.ExchangeRate, t.DedupeHash)
		if err != nil {
			return 0, err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			inserted++
		}
	}
	return inserted, tx.Commit()
}
