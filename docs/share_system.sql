-- Migration: share_system
-- Tabelas para o loop viral gamificado:
--   share_rewards       — recompensas configuradas pelo lojista
--   share_events        — postagens confirmadas + recompensas liberadas
--   referral_conversions — novos usuários que entraram via link de indicação

CREATE TABLE IF NOT EXISTS share_rewards (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN (
               'discount_percent', 'discount_fixed',
               'free_shipping', 'extra_tryon', 'early_access'
             )),
  value      NUMERIC,
  label      TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id           UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  product_id       UUID        REFERENCES products(id) ON DELETE SET NULL,
  tryon_image_url  TEXT,
  platform         TEXT        CHECK (platform IN ('instagram', 'whatsapp', 'tiktok', 'download')),
  ref_code         TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  reward_id        UUID        REFERENCES share_rewards(id) ON DELETE SET NULL,
  reward_unlocked  JSONB,
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_conversions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  new_user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id           UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  ref_code         TEXT        NOT NULL,
  converted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_share_rewards_org_id     ON share_rewards (org_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_share_events_org_id      ON share_events (org_id);
CREATE INDEX IF NOT EXISTS idx_share_events_ref_code    ON share_events (ref_code);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at  ON share_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_org_id          ON referral_conversions (org_id);
CREATE INDEX IF NOT EXISTS idx_referral_ref_code        ON referral_conversions (ref_code);

-- RLS
ALTER TABLE share_rewards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;

-- share_rewards: membros da org lêem; apenas service_role escreve
DROP POLICY IF EXISTS "share_rewards_org_member_select" ON share_rewards;
CREATE POLICY "share_rewards_org_member_select" ON share_rewards
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "share_rewards_org_member_insert" ON share_rewards;
CREATE POLICY "share_rewards_org_member_insert" ON share_rewards
  FOR INSERT WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "share_rewards_org_member_update" ON share_rewards;
CREATE POLICY "share_rewards_org_member_update" ON share_rewards
  FOR UPDATE USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "share_rewards_org_member_delete" ON share_rewards;
CREATE POLICY "share_rewards_org_member_delete" ON share_rewards
  FOR DELETE USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- share_events: membros da org lêem
DROP POLICY IF EXISTS "share_events_org_member_select" ON share_events;
CREATE POLICY "share_events_org_member_select" ON share_events
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- share_events: qualquer usuário autenticado pode inserir (consumidor final)
DROP POLICY IF EXISTS "share_events_authenticated_insert" ON share_events;
CREATE POLICY "share_events_authenticated_insert" ON share_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- referral_conversions: membros da org lêem
DROP POLICY IF EXISTS "referral_org_member_select" ON referral_conversions;
CREATE POLICY "referral_org_member_select" ON referral_conversions
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- referral_conversions: qualquer autenticado pode inserir (via link de entrada)
DROP POLICY IF EXISTS "referral_authenticated_insert" ON referral_conversions;
CREATE POLICY "referral_authenticated_insert" ON referral_conversions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
