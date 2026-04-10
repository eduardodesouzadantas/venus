-- Migration: org_branding
-- Campos de identidade da loja armazenados em orgs.

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#D4AF37';

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
