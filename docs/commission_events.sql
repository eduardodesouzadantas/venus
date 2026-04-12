CREATE TABLE IF NOT EXISTS commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  client_phone TEXT,
  product_id UUID REFERENCES products(id),
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  notes TEXT
);
ALTER TABLE commission_events ENABLE ROW LEVEL SECURITY;
