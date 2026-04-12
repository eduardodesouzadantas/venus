CREATE TABLE IF NOT EXISTS campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id),
  campaign_type TEXT NOT NULL,
  client_phone TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_org_id ON campaign_logs (org_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_type ON campaign_logs (campaign_type, sent_at DESC);
