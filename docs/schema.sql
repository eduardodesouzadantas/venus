CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  primary_color TEXT,
  style TEXT,
  type TEXT NOT NULL,
  price_range TEXT,
  image_url TEXT,
  external_url TEXT,
  b2b_user_id UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS saved_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_email TEXT,
  user_name TEXT,
  payload JSONB NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "B2B admin can read its own products"
  ON products FOR SELECT USING (auth.uid() = b2b_user_id);

CREATE POLICY "B2B admin can insert its own products"
  ON products FOR INSERT WITH CHECK (auth.uid() = b2b_user_id);

CREATE POLICY "Anyone can read products"
  ON products FOR SELECT USING (true);

ALTER TABLE saved_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert results randomly"
  ON saved_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update its own results"
  ON saved_results FOR UPDATE USING (true);

CREATE POLICY "Public can read results"
  ON saved_results FOR SELECT USING (true);
