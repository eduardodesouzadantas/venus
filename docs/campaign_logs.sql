CREATE TABLE IF NOT EXISTS campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL,
  client_phone TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_org ON campaign_logs(org_id);
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
