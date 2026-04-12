ALTER TABLE orgs ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS commission_active BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id),
  client_phone TEXT,
  product_id UUID REFERENCES products(id),
  sale_amount DECIMAL(10,2),
  commission_rate DECIMAL(5,2),
  commission_amount DECIMAL(10,2),
  confirmed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_events_org_id ON commission_events (org_id, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_events_product_id ON commission_events (product_id);
