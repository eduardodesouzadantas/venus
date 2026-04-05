CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS tenant;

CREATE TABLE IF NOT EXISTS orgs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked')),
  kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
  plan_id TEXT NOT NULL DEFAULT 'starter',
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'agency_owner',
    'agency_admin',
    'agency_ops',
    'agency_support',
    'merchant_owner',
    'merchant_manager',
    'merchant_editor',
    'merchant_viewer'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_usage_daily (
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  ai_tokens BIGINT NOT NULL DEFAULT 0,
  ai_requests BIGINT NOT NULL DEFAULT 0,
  messages_sent BIGINT NOT NULL DEFAULT 0,
  events_count BIGINT NOT NULL DEFAULT 0,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  cost_cents BIGINT NOT NULL DEFAULT 0,
  leads BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, usage_date)
);

CREATE TABLE IF NOT EXISTS tenant_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug ON orgs (slug);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members (org_id);
CREATE INDEX IF NOT EXISTS idx_org_usage_daily_org_id_date ON org_usage_daily (org_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_events_org_id_created_at ON tenant_events (org_id, created_at DESC);

CREATE OR REPLACE FUNCTION tenant.current_org_slug()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'org_slug',
      auth.jwt() -> 'user_metadata' ->> 'org_slug',
      auth.jwt() -> 'app_metadata' ->> 'org_id',
      auth.jwt() -> 'user_metadata' ->> 'org_id'
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION tenant.current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role'
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION tenant.is_agency_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(tenant.current_role() LIKE 'agency_%', FALSE);
$$;

CREATE OR REPLACE FUNCTION tenant.is_merchant_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(tenant.current_role() LIKE 'merchant_%', FALSE);
$$;

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE orgs FORCE ROW LEVEL SECURITY;
ALTER TABLE org_members FORCE ROW LEVEL SECURITY;
ALTER TABLE org_usage_daily FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read own org or agency" ON orgs;
CREATE POLICY "Org members can read own org or agency"
  ON orgs
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR slug = tenant.current_org_slug()
  );

DROP POLICY IF EXISTS "Agency can manage orgs" ON orgs;
CREATE POLICY "Agency can manage orgs"
  ON orgs
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Members can read membership or agency" ON org_members;
CREATE POLICY "Members can read membership or agency"
  ON org_members
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Agency can manage memberships" ON org_members;
CREATE POLICY "Agency can manage memberships"
  ON org_members
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Members can read usage or agency" ON org_usage_daily;
CREATE POLICY "Members can read usage or agency"
  ON org_usage_daily
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Agency can manage usage" ON org_usage_daily;
CREATE POLICY "Agency can manage usage"
  ON org_usage_daily
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Members can read tenant events or agency" ON tenant_events;
CREATE POLICY "Members can read tenant events or agency"
  ON tenant_events
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Agency can manage tenant events" ON tenant_events;
CREATE POLICY "Agency can manage tenant events"
  ON tenant_events
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

GRANT USAGE ON SCHEMA tenant TO authenticated;
GRANT EXECUTE ON FUNCTION tenant.current_org_slug() TO authenticated;
GRANT EXECUTE ON FUNCTION tenant.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION tenant.is_agency_user() TO authenticated;
GRANT EXECUTE ON FUNCTION tenant.is_merchant_user() TO authenticated;
GRANT SELECT ON orgs TO authenticated;
GRANT SELECT ON org_members TO authenticated;
GRANT SELECT ON org_usage_daily TO authenticated;
GRANT SELECT ON tenant_events TO authenticated;
