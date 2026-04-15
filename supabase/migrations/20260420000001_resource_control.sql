-- Resource Control Engine for Venus Engine
-- Hierarchical resource limits: agency -> merchant -> customer

-- Resource definitions table
CREATE TABLE IF NOT EXISTS org_resource_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  limit_monthly BIGINT NOT NULL DEFAULT 0,
  limit_override BIGINT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, resource_type)
);

-- Resource usage tracking table
CREATE TABLE IF NOT EXISTS org_resource_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  usage_period DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, resource_type, usage_period)
);

-- Resource consumption audit log
CREATE TABLE IF NOT EXISTS org_resource_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  previous_count BIGINT NOT NULL,
  new_count BIGINT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_limits_org_id ON org_resource_limits (org_id);
CREATE INDEX IF NOT EXISTS idx_resource_usage_org_period ON org_resource_usage (org_id, usage_period DESC);
CREATE INDEX IF NOT EXISTS idx_resource_usage_period ON org_resource_usage (usage_period DESC);
CREATE INDEX IF NOT EXISTS idx_resource_audit_org_id ON org_resource_audit (org_id);
CREATE INDEX IF NOT EXISTS idx_resource_audit_created_at ON org_resource_audit (created_at DESC);

ALTER TABLE org_resource_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_resource_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_resource_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE org_resource_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE org_resource_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE org_resource_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency manages resource limits" ON org_resource_limits;
CREATE POLICY "Agency manages resource limits"
  ON org_resource_limits FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Members can read resource usage for org" ON org_resource_usage;
CREATE POLICY "Members can read resource usage for org"
  ON org_resource_usage FOR SELECT
  USING (
    tenant.is_agency_user()
    OR org_id IN (SELECT id FROM orgs WHERE slug = tenant.current_org_slug())
  );

DROP POLICY IF EXISTS "System inserts resource usage" ON org_resource_usage;
CREATE POLICY "System inserts resource usage"
  ON org_resource_usage FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System updates resource usage" ON org_resource_usage;
CREATE POLICY "System updates resource usage"
  ON org_resource_usage FOR UPDATE
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON org_resource_usage TO authenticated;
GRANT SELECT, INSERT ON org_resource_limits TO authenticated;
GRANT SELECT ON org_resource_audit TO authenticated;

-- Function: can_consume_resource
CREATE OR REPLACE FUNCTION public.can_consume_resource(
  p_org_id UUID,
  p_resource_type TEXT,
  p_amount BIGINT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_limit BIGINT;
  v_used BIGINT;
  v_remaining BIGINT;
  v_allowed BOOLEAN;
  v_limit_source TEXT;
  v_result JSONB;
BEGIN
  -- Get limit: override first, then default from billing
  SELECT COALESCE(limit_override, limit_monthly, 0)
  INTO v_limit
  FROM org_resource_limits
  WHERE org_id = p_org_id AND resource_type = p_resource_type
  ORDER BY created_at DESC
  LIMIT 1;

  -- Default limits based on resource type
  IF v_limit IS NULL OR v_limit = 0 THEN
    v_limit := CASE p_resource_type
      WHEN 'ai_tokens' THEN 250000
      WHEN 'try_on' THEN 50
      WHEN 'whatsapp_message' THEN 1000
      WHEN 'saved_result' THEN 100
      WHEN 'product' THEN 500
      WHEN 'lead' THEN 500
      ELSE 1000
    END;
    v_limit_source := 'default';
  ELSE
    v_limit_source := 'override';
  END IF;

  -- Get current usage for this month
  SELECT COALESCE(used_count, 0)
  INTO v_used
  FROM org_resource_usage
  WHERE org_id = p_org_id
    AND resource_type = p_resource_type
    AND usage_period = CURRENT_DATE;

  IF v_used IS NULL THEN
    v_used := 0;
  END IF;

  v_remaining := v_limit - v_used;
  v_allowed := v_remaining >= p_amount;

  v_result := jsonb_build_object(
    'allowed', v_allowed,
    'resource_type', p_resource_type,
    'amount', p_amount,
    'used', v_used,
    'limit', v_limit,
    'remaining', v_remaining,
    'limit_source', v_limit_source,
    'usage_period', CURRENT_DATE
  );

  RETURN v_result;
END;
$$;

-- Function: consume_resource (atomic with rollback)
CREATE OR REPLACE FUNCTION public.consume_resource(
  p_org_id UUID,
  p_resource_type TEXT,
  p_amount BIGINT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_current_count BIGINT;
  v_new_count BIGINT;
  v_limit BIGINT;
  v_allowed BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check limits first
  SELECT limit_monthly INTO v_limit
  FROM org_resource_limits
  WHERE org_id = p_org_id AND resource_type = p_resource_type
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_limit IS NULL OR v_limit = 0 THEN
    v_limit := CASE p_resource_type
      WHEN 'ai_tokens' THEN 250000
      WHEN 'try_on' THEN 50
      WHEN 'whatsapp_message' THEN 1000
      WHEN 'saved_result' THEN 100
      WHEN 'product' THEN 500
      WHEN 'lead' THEN 500
      ELSE 1000
    END;
  END IF;

  -- Get or create usage record
  INSERT INTO org_resource_usage (org_id, resource_type, usage_period, used_count, updated_at)
  VALUES (p_org_id, p_resource_type, CURRENT_DATE, 0, NOW())
  ON CONFLICT (org_id, resource_type, usage_period) 
  DO UPDATE SET used_count = org_resource_usage.used_count
  RETURNING used_count INTO v_current_count;

  v_new_count := v_current_count + p_amount;
  v_allowed := v_new_count <= v_limit;

  IF NOT v_allowed THEN
    v_result := jsonb_build_object(
      'success', FALSE,
      'error', 'limit_exceeded',
      'resource_type', p_resource_type,
      'amount', p_amount,
      'used', v_current_count,
      'limit', v_limit,
      'remaining', v_limit - v_current_count
    );

    INSERT INTO org_resource_audit (org_id, resource_type, amount, previous_count, new_count, action, result, error_message)
    VALUES (p_org_id, p_resource_type, p_amount, v_current_count, v_new_count, 'consume', 'blocked', 'limit_exceeded');

    RETURN v_result;
  END IF;

  UPDATE org_resource_usage
  SET used_count = v_new_count, updated_at = NOW()
  WHERE org_id = p_org_id AND resource_type = p_resource_type AND usage_period = CURRENT_DATE;

  v_result := jsonb_build_object(
    'success', TRUE,
    'resource_type', p_resource_type,
    'amount', p_amount,
    'used', v_new_count,
    'limit', v_limit,
    'remaining', v_limit - v_new_count
  );

  INSERT INTO org_resource_audit (org_id, resource_type, amount, previous_count, new_count, action, result)
  VALUES (p_org_id, p_resource_type, p_amount, v_current_count, v_new_count, 'consume', 'allowed');

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_consume_resource(UUID, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_resource(UUID, TEXT, BIGINT) TO authenticated;