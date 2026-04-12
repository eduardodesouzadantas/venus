CREATE TABLE IF NOT EXISTS lead_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  style_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  colorimetry JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  intent_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  emotional_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_tryon JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_products_viewed JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_context_org_id ON lead_context (org_id);
CREATE INDEX IF NOT EXISTS idx_lead_context_org_user_id ON lead_context (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lead_context_org_updated_at ON lead_context (org_id, updated_at DESC);

CREATE OR REPLACE FUNCTION tenant.touch_lead_context_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_touch_lead_context_updated_at ON lead_context;
CREATE TRIGGER trigger_touch_lead_context_updated_at
  BEFORE UPDATE ON lead_context
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_lead_context_updated_at();

ALTER TABLE lead_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_context FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage lead context" ON lead_context;
DROP POLICY IF EXISTS "Merchant can read lead context for org" ON lead_context;
DROP POLICY IF EXISTS "Merchant can insert lead context for org" ON lead_context;
DROP POLICY IF EXISTS "Merchant can update lead context for org" ON lead_context;

CREATE POLICY "Agency can manage lead context"
  ON lead_context
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

CREATE POLICY "Merchant can read lead context for org"
  ON lead_context
  FOR SELECT
  USING (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can insert lead context for org"
  ON lead_context
  FOR INSERT
  WITH CHECK (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can update lead context for org"
  ON lead_context
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

GRANT SELECT, INSERT, UPDATE ON lead_context TO authenticated;
