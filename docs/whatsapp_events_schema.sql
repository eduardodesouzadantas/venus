-- WhatsApp Events Tracking Table
CREATE TABLE IF NOT EXISTS whatsapp_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  org_slug TEXT NOT NULL, -- Multi-tenant scope
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- smart_reply_shown, smart_reply_clicked, smart_reply_applied, smart_reply_sent
  dedupe_key TEXT,
  smart_reply_id TEXT,
  smart_reply_angle TEXT, -- closing, objection, desire, price, fit
  smart_reply_label TEXT,
  smart_reply_confidence FLOAT,
  payload JSONB DEFAULT '{}'
);

ALTER TABLE whatsapp_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Enable RLS
ALTER TABLE whatsapp_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE whatsapp_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read events" ON whatsapp_events;
DROP POLICY IF EXISTS "Public insert events" ON whatsapp_events;
DROP POLICY IF EXISTS "Tenant read events" ON whatsapp_events;
DROP POLICY IF EXISTS "Tenant insert events" ON whatsapp_events;

CREATE POLICY "Tenant read events"
  ON whatsapp_events
  FOR SELECT
  USING (org_slug = whatsapp.current_org_slug());

CREATE POLICY "Tenant insert events"
  ON whatsapp_events
  FOR INSERT
  WITH CHECK (org_slug = whatsapp.current_org_slug());

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_events_dedupe_key_uidx
  ON whatsapp_events (dedupe_key);

CREATE INDEX IF NOT EXISTS whatsapp_events_org_slug_conversation_created_idx
  ON whatsapp_events (org_slug, conversation_id, created_at DESC);
