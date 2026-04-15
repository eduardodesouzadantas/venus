-- CRM operational enhancements for Venus Engine
-- Apply after leads_migration.sql

-- Add CRM columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL;

-- Update status CHECK to include closing
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'engaged', 'qualified', 'offer_sent', 'closing', 'won', 'lost'));

-- Create timeline table
CREATE TABLE IF NOT EXISTS lead_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_timeline_lead_id ON lead_timeline (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_timeline_org_id ON lead_timeline (org_id);
CREATE INDEX IF NOT EXISTS idx_lead_timeline_created_at ON lead_timeline (created_at DESC);

-- Enable RLS
ALTER TABLE lead_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_timeline FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage lead timeline" ON lead_timeline;
DROP POLICY IF EXISTS "Merchant can read lead timeline for org" ON lead_timeline;
DROP POLICY IF EXISTS "Merchant can insert lead timeline for org" ON lead_timeline;

CREATE POLICY "Agency can manage lead timeline"
  ON lead_timeline
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

CREATE POLICY "Merchant can read lead timeline for org"
  ON lead_timeline
  FOR SELECT
  USING (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id FROM orgs WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can insert lead timeline for org"
  ON lead_timeline
  FOR INSERT
  WITH CHECK (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id FROM orgs WHERE slug = tenant.current_org_slug()
    )
  );

-- Grants
GRANT SELECT, INSERT ON lead_timeline TO authenticated;

-- Add conversation_id index
CREATE INDEX IF NOT EXISTS idx_leads_conversation_id ON leads (conversation_id);

-- Add owner index
CREATE INDEX IF NOT EXISTS idx_leads_owner_user_id ON leads (owner_user_id);

-- Grant for new columns
GRANT SELECT, UPDATE ON leads TO authenticated; -- already has INSERT