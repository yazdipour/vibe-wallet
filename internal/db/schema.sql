CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  icon       TEXT NOT NULL DEFAULT 'Tag',
  color      TEXT NOT NULL DEFAULT '#6b7280',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  field       TEXT NOT NULL CHECK(field IN ('partner_iban','partner_name','type','payment_reference')),
  match_type  TEXT NOT NULL CHECK(match_type IN ('exact','keyword')),
  pattern     TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_dedup ON rules(field, match_type, pattern);

CREATE TABLE IF NOT EXISTS transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  booking_date      TEXT,
  value_date        TEXT,
  partner_name      TEXT,
  partner_iban      TEXT,
  type              TEXT,
  payment_reference TEXT,
  amount_eur        REAL,
  original_amount   REAL,
  original_currency TEXT,
  exchange_rate     REAL,
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  categorized_by    TEXT,                 -- 'rule' | 'llm' | NULL
  dedupe_hash       TEXT NOT NULL UNIQUE, -- prevents double-import
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
