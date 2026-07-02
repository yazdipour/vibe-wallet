package model

type Transaction struct {
	ID               int64    `json:"id"`
	AccountID        int64    `json:"account_id"`
	AccountName      string   `json:"account_name"` // from CSV, used to resolve AccountID
	BookingDate      string   `json:"booking_date"`
	ValueDate        string   `json:"value_date"`
	PartnerName      string   `json:"partner_name"`
	PartnerIban      string   `json:"partner_iban"`
	Type             string   `json:"type"`
	PaymentReference string   `json:"payment_reference"`
	AmountEUR        float64  `json:"amount_eur"`
	OriginalAmount   *float64 `json:"original_amount"`
	OriginalCurrency string   `json:"original_currency"`
	ExchangeRate     *float64 `json:"exchange_rate"`
	CategoryID       *int64   `json:"category_id"`
	CategorizedBy    string   `json:"categorized_by"`
	CategoryName     string   `json:"category_name"`
	Category         string   `json:"-"` // raw category name from a native-format CSV row, resolved by the upload handler
	DedupeHash       string   `json:"-"`
}

type Account struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Category struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	Color     string `json:"color"`
	IconColor string `json:"icon_color"`
}

type Rule struct {
	ID         int64  `json:"id"`
	Field      string `json:"field"`
	MatchType  string `json:"match_type"`
	Pattern    string `json:"pattern"`
	CategoryID int64  `json:"category_id"`
}
