ALTER TABLE products
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(org_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "B2B admin can read its own products" ON products;
DROP POLICY IF EXISTS "B2B admin can insert its own products" ON products;
DROP POLICY IF EXISTS "Anyone can read products" ON products;

CREATE POLICY "Merchant can read catalog by org"
  ON products
  FOR SELECT
  USING (
    auth.uid() = b2b_user_id
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can insert catalog by org"
  ON products
  FOR INSERT
  WITH CHECK (
    (
      org_id IS NOT NULL
      AND org_id IN (
        SELECT id
        FROM orgs
        WHERE slug = tenant.current_org_slug()
      )
    )
    OR auth.uid() = b2b_user_id
  );

CREATE POLICY "Merchant can update catalog by org"
  ON products
  FOR UPDATE
  USING (
    auth.uid() = b2b_user_id
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    auth.uid() = b2b_user_id
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );
