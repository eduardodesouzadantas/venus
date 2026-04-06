CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'app',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'engaged', 'qualified', 'offer_sent', 'won', 'lost')),
  saved_result_id UUID UNIQUE REFERENCES saved_results(id) ON DELETE SET NULL,
  intent_score NUMERIC,
  whatsapp_key TEXT,
  next_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ
);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;

ALTER TABLE org_usage_daily
  ADD COLUMN IF NOT EXISTS leads BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads (org_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_saved_result_id ON leads (saved_result_id);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_key ON leads (whatsapp_key);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up_at ON leads (next_follow_up_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_phone_unique ON leads (org_id, phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_email_unique ON leads (org_id, email) WHERE email IS NOT NULL AND email <> '';

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage leads" ON leads;
DROP POLICY IF EXISTS "Merchant can read leads for org" ON leads;
DROP POLICY IF EXISTS "Merchant can insert leads for org" ON leads;
DROP POLICY IF EXISTS "Merchant can update leads for org" ON leads;

CREATE POLICY "Agency can manage leads"
  ON leads
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

CREATE POLICY "Merchant can read leads for org"
  ON leads
  FOR SELECT
  USING (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can insert leads for org"
  ON leads
  FOR INSERT
  WITH CHECK (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

CREATE POLICY "Merchant can update leads for org"
  ON leads
  FOR UPDATE
  USING (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_merchant_user()
    AND org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

GRANT SELECT, INSERT, UPDATE ON leads TO authenticated;

INSERT INTO leads (
  org_id,
  name,
  email,
  phone,
  source,
  status,
  saved_result_id,
  intent_score,
  whatsapp_key,
  last_interaction_at
)
SELECT
  sr.org_id,
  COALESCE(
    NULLIF(sr.user_name, ''),
    NULLIF(sr.payload->'onboardingContext'->'contact'->>'name', ''),
    'Cliente Venus'
  ) AS name,
  NULLIF(LOWER(COALESCE(sr.user_email, sr.payload->'onboardingContext'->'contact'->>'email', '')), '') AS email,
  NULLIF(
    REGEXP_REPLACE(
      COALESCE(
        sr.payload->'onboardingContext'->'contact'->>'phone',
        sr.payload->'whatsappHandoff'->>'contactPhone',
        ''
      ),
      '\\D',
      '',
      'g'
    ),
    ''
  ) AS phone,
  'app' AS source,
  'new' AS status,
  sr.id AS saved_result_id,
  CASE
    WHEN NULLIF(sr.payload->'onboardingContext'->'intent'->>'satisfaction', '') IS NULL THEN NULL
    ELSE LEAST(100, GREATEST(0, (sr.payload->'onboardingContext'->'intent'->>'satisfaction')::numeric * 10))
  END AS intent_score,
  NULLIF(
    REGEXP_REPLACE(
      COALESCE(
        sr.payload->'onboardingContext'->'contact'->>'phone',
        sr.payload->'whatsappHandoff'->>'contactPhone',
        ''
      ),
      '\\D',
      '',
      'g'
    ),
    ''
  ) AS whatsapp_key,
  COALESCE(
    sr.payload->'whatsappHandoff'->>'createdAt',
    sr.created_at::text
  )::timestamptz AS last_interaction_at
FROM saved_results sr
WHERE sr.org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM leads l
    WHERE l.saved_result_id = sr.id
  )
  AND (
    COALESCE(
      NULLIF(sr.user_email, ''),
      NULLIF(sr.user_name, ''),
      NULLIF(sr.payload->'onboardingContext'->'contact'->>'phone', ''),
      NULLIF(sr.payload->'whatsappHandoff'->>'contactPhone', '')
    ) IS NOT NULL
  );
