CREATE TABLE IF NOT EXISTS wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone TEXT NOT NULL,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT,
  category TEXT,
  color TEXT,
  season TEXT,
  image_url TEXT,
  analysis JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wardrobe_phone ON wardrobe_items(client_phone);
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
