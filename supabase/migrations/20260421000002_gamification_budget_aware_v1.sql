-- Gamification Budget-Aware v1
-- Merchant-managed rewards constrained by the existing Resource Control Engine.

CREATE TABLE IF NOT EXISTS gamification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'share_bonus',
    'return_after_days',
    'onboarding_complete',
    'recurring_interaction',
    'purchase_confirmed'
  )),
  trigger_mode TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_mode IN ('manual', 'automatic')),
  trigger_event_type TEXT CHECK (trigger_event_type IN (
    'onboarding_completed',
    'lead_reengaged',
    'result_shared'
  )),
  benefit_resource_type TEXT NOT NULL CHECK (benefit_resource_type IN (
    'ai_tokens',
    'try_on',
    'whatsapp_message'
  )),
  benefit_amount BIGINT NOT NULL DEFAULT 1 CHECK (benefit_amount > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  per_customer_limit BIGINT NOT NULL DEFAULT 1 CHECK (per_customer_limit > 0),
  per_customer_period_days INT NOT NULL DEFAULT 30 CHECK (per_customer_period_days > 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  label TEXT NOT NULL,
  description TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES gamification_rules(id) ON DELETE SET NULL,
  customer_key TEXT,
  customer_label TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'rule_create',
    'rule_update',
    'rule_deactivate',
    'grant',
    'consume',
    'block'
  )),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'blocked')),
  source_event_type TEXT CHECK (source_event_type IN (
    'onboarding_completed',
    'lead_reengaged',
    'result_shared'
  )),
  source_event_key TEXT,
  resource_type TEXT CHECK (resource_type IN (
    'ai_tokens',
    'try_on',
    'whatsapp_message'
  )),
  amount BIGINT NOT NULL DEFAULT 0,
  reason TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_rules_org_id ON gamification_rules (org_id, active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_rules_org_rule_type ON gamification_rules (org_id, rule_type);
CREATE INDEX IF NOT EXISTS idx_gamification_rules_org_trigger ON gamification_rules (org_id, trigger_mode, trigger_event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_events_org_id ON gamification_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_events_customer ON gamification_events (org_id, customer_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_events_rule_id ON gamification_events (org_id, rule_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_events_source_event_key
  ON gamification_events (org_id, rule_id, source_event_key)
  WHERE source_event_key IS NOT NULL;

ALTER TABLE gamification_rules
  ADD COLUMN IF NOT EXISTS trigger_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_event_type TEXT;

ALTER TABLE gamification_events
  ADD COLUMN IF NOT EXISTS source_event_type TEXT,
  ADD COLUMN IF NOT EXISTS source_event_key TEXT;

ALTER TABLE gamification_rules
  DROP CONSTRAINT IF EXISTS gamification_rules_trigger_mode_check;
ALTER TABLE gamification_rules
  ADD CONSTRAINT gamification_rules_trigger_mode_check CHECK (trigger_mode IN ('manual', 'automatic'));

ALTER TABLE gamification_rules
  DROP CONSTRAINT IF EXISTS gamification_rules_trigger_event_type_check;
ALTER TABLE gamification_rules
  ADD CONSTRAINT gamification_rules_trigger_event_type_check CHECK (
    trigger_event_type IS NULL
    OR trigger_event_type IN (
      'onboarding_completed',
      'lead_reengaged',
      'result_shared'
    )
  );

ALTER TABLE gamification_events
  DROP CONSTRAINT IF EXISTS gamification_events_source_event_type_check;
ALTER TABLE gamification_events
  ADD CONSTRAINT gamification_events_source_event_type_check CHECK (
    source_event_type IS NULL
    OR source_event_type IN (
      'onboarding_completed',
      'lead_reengaged',
      'result_shared'
    )
  );

ALTER TABLE gamification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE gamification_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE gamification_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gamification rules org members read" ON gamification_rules;
CREATE POLICY "Gamification rules org members read"
  ON gamification_rules FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gamification rules org members write" ON gamification_rules;
CREATE POLICY "Gamification rules org members write"
  ON gamification_rules FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gamification events org members read" ON gamification_events;
CREATE POLICY "Gamification events org members read"
  ON gamification_events FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gamification events org members write" ON gamification_events;
CREATE POLICY "Gamification events org members write"
  ON gamification_events FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON gamification_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gamification_events TO authenticated;
