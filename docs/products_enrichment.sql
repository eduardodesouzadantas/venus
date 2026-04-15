ALTER TABLE products
  ADD COLUMN IF NOT EXISTS emotional_copy TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tags TEXT[];

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS persuasive_description TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS size_type TEXT DEFAULT 'clothing';
