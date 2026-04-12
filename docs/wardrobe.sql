CREATE TABLE IF NOT EXISTS wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone TEXT NOT NULL,
  org_id UUID REFERENCES orgs(id),
  name TEXT,
  category TEXT,
  color TEXT,
  image_url TEXT,
  analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_client_phone ON wardrobe_items (client_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_org_id ON wardrobe_items (org_id, created_at DESC);
