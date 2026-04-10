-- Fix: link WhatsApp Meta integration to maison-elite
-- Note: whatsapp_meta_integrations does not have a status column in the repo schema.

INSERT INTO whatsapp_meta_integrations (
  org_id,
  phone_number_id,
  business_account_id,
  display_phone_number,
  connected_at,
  created_at,
  updated_at
)
SELECT
  id,
  '1010799278786636',
  '3367627820055900',
  '+55 11 96701-1133',
  now(),
  now(),
  now()
FROM orgs
WHERE slug = 'maison-elite'
ON CONFLICT (org_id) DO NOTHING;
