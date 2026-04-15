-- Campaign engine schema for Venus Engine
-- Apply after tenant_core and CRM migrations

-- Campaign definitions
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  audience_query JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_template JSONB NOT NULL DEFAULT '{"type": "text", "content": ""}'::jsonb,
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{"daily_limit": 50, "per_user_limit": 3}'::jsonb,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign execution runs
CREATE TABLE IF NOT EXISTS campaign_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  trigger_event TEXT,
  audience_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign triggers (automatic rules)
CREATE TABLE IF NOT EXISTS campaign_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign logs (individual messages)
CREATE TABLE IF NOT EXISTS campaign_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES campaign_runs(id) ON DELETE SET NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON campaigns (org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign_id ON campaign_runs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_org_id ON campaign_runs (org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_created_at ON campaign_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_triggers_org_id ON campaign_triggers (org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_triggers_enabled ON campaign_triggers (is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_logs_run_id ON campaign_logs (run_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id ON campaign_logs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_lead_id ON campaign_logs (lead_id);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_triggers FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs FORCE ROW LEVEL SECURITY;

-- Campaign policies
DROP POLICY IF EXISTS "Agency can manage campaigns" ON campaigns;
CREATE POLICY "Agency can manage campaigns"
  ON campaigns FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

-- Campaign run policies
DROP POLICY IF EXISTS "Agency can manage campaign runs" ON campaign_runs;
CREATE POLICY "Agency can manage campaign runs"
  ON campaign_runs FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

-- Campaign trigger policies
DROP POLICY IF EXISTS "Agency can manage campaign triggers" ON campaign_triggers;
CREATE POLICY "Agency can manage campaign triggers"
  ON campaign_triggers FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

-- Campaign log policies
DROP POLICY IF EXISTS "Agency can manage campaign logs" ON campaign_logs;
CREATE POLICY "Agency can manage campaign logs"
  ON campaign_logs FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

-- Grants
GRANT SELECT ON campaigns TO authenticated;
GRANT SELECT ON campaign_runs TO authenticated;
GRANT SELECT ON campaign_triggers TO authenticated;
GRANT SELECT ON campaign_logs TO authenticated;