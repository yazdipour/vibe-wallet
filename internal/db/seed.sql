INSERT OR IGNORE INTO categories (name, kind) VALUES
  ('Groceries', 'expense'), ('Eating Out', 'expense'), ('Transport', 'expense'), ('Shopping', 'expense'),
  ('Bills & Utilities', 'expense'), ('Income', 'income'), ('Savings', 'income'), ('Entertainment', 'expense'),
  ('Health', 'expense'), ('Uncategorized', 'expense'), ('Ignore', 'expense');

-- Groceries rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Lidl', id FROM categories WHERE name='Groceries';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Aldi', id FROM categories WHERE name='Groceries';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Hofer', id FROM categories WHERE name='Groceries';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Billa', id FROM categories WHERE name='Groceries';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Spar', id FROM categories WHERE name='Groceries';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Penny', id FROM categories WHERE name='Groceries';

-- Eating Out rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'McDonald', id FROM categories WHERE name='Eating Out';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Starbucks', id FROM categories WHERE name='Eating Out';

-- Transport rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Uber', id FROM categories WHERE name='Transport';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'OEBB', id FROM categories WHERE name='Transport';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Wiener Linien', id FROM categories WHERE name='Transport';

-- Shopping rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Amazon', id FROM categories WHERE name='Shopping';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'IKEA', id FROM categories WHERE name='Shopping';

-- Entertainment rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Netflix', id FROM categories WHERE name='Entertainment';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Spotify', id FROM categories WHERE name='Entertainment';

-- Bills & Utilities rules
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'A1', id FROM categories WHERE name='Bills & Utilities';
INSERT OR IGNORE INTO rules (field, match_type, pattern, category_id)
  SELECT 'partner_name', 'keyword', 'Magenta', id FROM categories WHERE name='Bills & Utilities';
