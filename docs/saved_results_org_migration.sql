ALTER TABLE saved_results
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_results_org_id ON saved_results (org_id);
CREATE INDEX IF NOT EXISTS idx_saved_results_created_at ON saved_results (created_at DESC);

ALTER TABLE saved_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_results FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert results randomly" ON saved_results;
DROP POLICY IF EXISTS "Public can update its own results" ON saved_results;
DROP POLICY IF EXISTS "Public can read results" ON saved_results;
DROP POLICY IF EXISTS "Merchant can read saved results for org" ON saved_results;
DROP POLICY IF EXISTS "Merchant can insert saved results for org" ON saved_results;
DROP POLICY IF EXISTS "Merchant can update saved results for org" ON saved_results;
DROP POLICY IF EXISTS "Agency can manage saved results" ON saved_results;

CREATE POLICY "Agency can manage saved results"
  ON saved_results
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

CREATE POLICY "Merchant can read saved results for org"
  ON saved_results
  FOR SELECT
  USING (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can insert saved results for org"
  ON saved_results
  FOR INSERT
  WITH CHECK (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can update saved results for org"
  ON saved_results
  FOR UPDATE
  USING (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

GRANT SELECT, INSERT, UPDATE ON saved_results TO authenticated;
