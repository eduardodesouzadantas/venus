ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_status TEXT;

UPDATE products
SET
  stock_qty = COALESCE(stock_qty, stock, 0),
  stock = COALESCE(stock, stock_qty, 0),
  reserved_qty = COALESCE(reserved_qty, 0);

UPDATE products
SET stock_status = CASE
  WHEN COALESCE(stock_qty, stock, 0) - COALESCE(reserved_qty, 0) <= 0 THEN 'out_of_stock'
  WHEN COALESCE(stock_qty, stock, 0) - COALESCE(reserved_qty, 0) <= 5 THEN 'low_stock'
  ELSE 'in_stock'
END
WHERE stock_status IS NULL;
