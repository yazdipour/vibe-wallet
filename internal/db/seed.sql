INSERT OR IGNORE INTO categories (name, kind) VALUES
  ('Groceries', 'expense'), ('Eating Out', 'expense'), ('Transport', 'expense'), ('Shopping', 'expense'),
  ('Bills & Utilities', 'expense'), ('Income', 'income'), ('Savings', 'income'), ('Entertainment', 'expense'),
  ('Health', 'expense'), ('Uncategorized', 'expense'), ('Ignore', 'expense');

-- Groceries rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Lidl', id FROM categories WHERE name='Groceries';
