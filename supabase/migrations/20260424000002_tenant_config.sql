CREATE TABLE IF NOT EXISTS tenant_catalog_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'external_api', 'url', 'internal')),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'syncing')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_ai_config (
  org_id UUID PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  guided_mode_required BOOLEAN NOT NULL DEFAULT FALSE,
  max_interaction_turns INTEGER NOT NULL DEFAULT 20,
  response_time_limit_ms INTEGER NOT NULL DEFAULT 5000,
  fallback_to_human_threshold INTEGER NOT NULL DEFAULT 3,
  custom_instructions TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT 'consultive',
  language_style TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_capability_usage (
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  usage_date DATE NOT NULL,
  usage_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, capability, usage_date)
);

CREATE TABLE IF NOT EXISTS tenant_knowledge_base_config (
  org_id UUID PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  embedding_model TEXT,
  similarity_threshold NUMERIC NOT NULL DEFAULT 0.7,
  max_results INTEGER NOT NULL DEFAULT 5,
  auto_sync BOOLEAN NOT NULL DEFAULT FALSE,
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  embedding JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_catalog_sources_org_priority
  ON tenant_catalog_sources (org_id, priority ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_catalog_sources_default
  ON tenant_catalog_sources (org_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_tenant_ai_config_updated_at
  ON tenant_ai_config (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_capability_usage_org_date
  ON tenant_capability_usage (org_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_base_org_category
  ON tenant_knowledge_base (org_id, category);

CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_base_org_active
  ON tenant_knowledge_base (org_id, is_active);

CREATE OR REPLACE FUNCTION tenant.touch_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_touch_tenant_catalog_sources_updated_at ON tenant_catalog_sources;
CREATE TRIGGER trigger_touch_tenant_catalog_sources_updated_at
  BEFORE UPDATE ON tenant_catalog_sources
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_config_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_tenant_ai_config_updated_at ON tenant_ai_config;
CREATE TRIGGER trigger_touch_tenant_ai_config_updated_at
  BEFORE UPDATE ON tenant_ai_config
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_config_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_tenant_capability_usage_updated_at ON tenant_capability_usage;
CREATE TRIGGER trigger_touch_tenant_capability_usage_updated_at
  BEFORE UPDATE ON tenant_capability_usage
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_config_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_tenant_knowledge_base_config_updated_at ON tenant_knowledge_base_config;
CREATE TRIGGER trigger_touch_tenant_knowledge_base_config_updated_at
  BEFORE UPDATE ON tenant_knowledge_base_config
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_config_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_tenant_knowledge_base_updated_at ON tenant_knowledge_base;
CREATE TRIGGER trigger_touch_tenant_knowledge_base_updated_at
  BEFORE UPDATE ON tenant_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_config_updated_at();

ALTER TABLE tenant_catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_capability_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_knowledge_base_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_knowledge_base ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenant_catalog_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_ai_config FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_capability_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_knowledge_base_config FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_knowledge_base FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read catalog sources or agency" ON tenant_catalog_sources;
CREATE POLICY "Members can read catalog sources or agency"
  ON tenant_catalog_sources
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can manage catalog sources or agency" ON tenant_catalog_sources;
CREATE POLICY "Members can manage catalog sources or agency"
  ON tenant_catalog_sources
  FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can read AI config or agency" ON tenant_ai_config;
CREATE POLICY "Members can read AI config or agency"
  ON tenant_ai_config
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can manage AI config or agency" ON tenant_ai_config;
CREATE POLICY "Members can manage AI config or agency"
  ON tenant_ai_config
  FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can read capability usage or agency" ON tenant_capability_usage;
CREATE POLICY "Members can read capability usage or agency"
  ON tenant_capability_usage
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can manage capability usage or agency" ON tenant_capability_usage;
CREATE POLICY "Members can manage capability usage or agency"
  ON tenant_capability_usage
  FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can read KB config or agency" ON tenant_knowledge_base_config;
CREATE POLICY "Members can read KB config or agency"
  ON tenant_knowledge_base_config
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can manage KB config or agency" ON tenant_knowledge_base_config;
CREATE POLICY "Members can manage KB config or agency"
  ON tenant_knowledge_base_config
  FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can read KB entries or agency" ON tenant_knowledge_base;
CREATE POLICY "Members can read KB entries or agency"
  ON tenant_knowledge_base
  FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

DROP POLICY IF EXISTS "Members can manage KB entries or agency" ON tenant_knowledge_base;
CREATE POLICY "Members can manage KB entries or agency"
  ON tenant_knowledge_base
  FOR ALL
  USING (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  )
  WITH CHECK (
    tenant.is_agency_user()
    OR org_id IN (
      SELECT id
      FROM orgs
      WHERE slug = tenant.current_org_slug()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_catalog_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_ai_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_capability_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_knowledge_base_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_knowledge_base TO authenticated;
