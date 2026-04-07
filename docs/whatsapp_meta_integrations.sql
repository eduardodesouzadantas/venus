CREATE TABLE IF NOT EXISTS whatsapp_meta_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  display_phone_number TEXT,
  verified_name TEXT,
  quality_rating TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_meta_integrations_org_id
  ON whatsapp_meta_integrations (org_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_meta_integrations_phone_number_id
  ON whatsapp_meta_integrations (phone_number_id);

ALTER TABLE whatsapp_meta_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_meta_integrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage whatsapp meta integrations" ON whatsapp_meta_integrations;
CREATE POLICY "Agency can manage whatsapp meta integrations"
  ON whatsapp_meta_integrations
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Members can read whatsapp meta integrations or agency" ON whatsapp_meta_integrations;
CREATE POLICY "Members can read whatsapp meta integrations or agency"
  ON whatsapp_meta_integrations
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

GRANT SELECT ON whatsapp_meta_integrations TO authenticated;
