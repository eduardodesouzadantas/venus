-- WhatsApp module tables
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ai_active', -- ai_active, human_required, human_takeover, resolved, follow_up
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
  last_message TEXT,
  unread_count INT DEFAULT 0,
  user_phone TEXT,
  user_name TEXT,
  user_context JSONB DEFAULT '{}', -- styleIdentity, intentScore, viewedProducts, etc.
  org_slug TEXT NOT NULL -- for multi-tenant support
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  org_slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sender TEXT NOT NULL, -- user, ai, merchant
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- text, product_link, bundle_push, try_on_result
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS org_slug TEXT;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS org_slug TEXT;

CREATE SCHEMA IF NOT EXISTS whatsapp;

CREATE OR REPLACE FUNCTION whatsapp.current_org_slug()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  -- Accepts either direct JWT claims or metadata copied into the Supabase session.
  SELECT NULLIF(
    COALESCE(
      auth.jwt() ->> 'org_slug',
      auth.jwt() ->> 'orgId',
      auth.jwt() ->> 'org_id',
      auth.jwt() -> 'app_metadata' ->> 'org_slug',
      auth.jwt() -> 'app_metadata' ->> 'org_id',
      auth.jwt() -> 'user_metadata' ->> 'org_slug',
      auth.jwt() -> 'user_metadata' ->> 'org_id'
    ),
    ''
  );
$$;

-- Realtime configuration
-- Note: You must manually enable replication for these tables in the Supabase Dashboard
-- ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;

-- Enable RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE whatsapp_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Public insert conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Public update conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Tenant read conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Tenant insert conversations" ON whatsapp_conversations;
DROP POLICY IF EXISTS "Tenant update conversations" ON whatsapp_conversations;

DROP POLICY IF EXISTS "Public read messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Public insert messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Tenant read messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Tenant insert messages" ON whatsapp_messages;

CREATE POLICY "Tenant read conversations"
  ON whatsapp_conversations
  FOR SELECT
  USING (org_slug = whatsapp.current_org_slug());

CREATE POLICY "Tenant insert conversations"
  ON whatsapp_conversations
  FOR INSERT
  WITH CHECK (org_slug = whatsapp.current_org_slug());

CREATE POLICY "Tenant update conversations"
  ON whatsapp_conversations
  FOR UPDATE
  USING (org_slug = whatsapp.current_org_slug())
  WITH CHECK (org_slug = whatsapp.current_org_slug());

CREATE POLICY "Tenant read messages"
  ON whatsapp_messages
  FOR SELECT
  USING (org_slug = whatsapp.current_org_slug());

CREATE POLICY "Tenant insert messages"
  ON whatsapp_messages
  FOR INSERT
  WITH CHECK (org_slug = whatsapp.current_org_slug());

-- Tenant-aware indexes for application-side filtering and future RLS hardening
CREATE INDEX IF NOT EXISTS whatsapp_conversations_org_slug_last_updated_idx
  ON whatsapp_conversations (org_slug, last_updated DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_org_slug_conversation_created_idx
  ON whatsapp_messages (org_slug, conversation_id, created_at DESC);
