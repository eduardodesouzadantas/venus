-- Security hardening for Venus Engine
-- Rate limiting, audit logs, and security tables

-- Rate limit entries table
CREATE TABLE IF NOT EXISTS security_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 0,
  last_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rate_limit_scope_key ON security_rate_limits (scope, key);

-- Audit log table (server-side persistence)
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON security_audit_logs (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON security_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON security_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON security_audit_logs (created_at DESC);

-- Security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_org_id ON security_alerts (org_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unresolved ON security_alerts (is_resolved) WHERE is_resolved = FALSE;

-- Blocked IPs table
CREATE TABLE IF NOT EXISTS security_blocked_ips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_until TIMESTAMPTZ,
  blocked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_until ON security_blocked_ips (blocked_until) WHERE blocked_until IS NOT NULL;

-- RLS
ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_blocked_ips ENABLE ROW LEVEL SECURITY;

ALTER TABLE security_rate_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE security_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE security_blocked_ips FORCE ROW LEVEL SECURITY;

-- Agency only policies for security tables
DROP POLICY IF EXISTS "Agency manages rate limits" ON security_rate_limits;
CREATE POLICY "Agency manages rate limits"
  ON security_rate_limits FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Agency manages audit logs" ON security_audit_logs;
CREATE POLICY "Agency manages audit logs"
  ON security_audit_logs FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Agency manages security alerts" ON security_alerts;
CREATE POLICY "Agency manages security alerts"
  ON security_alerts FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Agency manages blocked IPs" ON security_blocked_ips;
CREATE POLICY "Agency manages blocked IPs"
  ON security_blocked_ips FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

-- Grants
GRANT SELECT, INSERT ON security_audit_logs TO authenticated;
GRANT SELECT ON security_alerts TO authenticated;
GRANT SELECT ON security_blocked_ips TO authenticated;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_scope TEXT,
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  SELECT COALESCE(count, 0) INTO v_current_count
  FROM security_rate_limits
  WHERE scope = p_scope AND key = p_key AND window_start > v_window_start;
  
  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;
  
  IF v_current_count >= p_limit THEN
    v_result := jsonb_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'retry_after_seconds', p_window_seconds,
      'current_count', v_current_count
    );
  ELSE
    v_result := jsonb_build_object(
      'allowed', TRUE,
      'remaining', p_limit - v_current_count - 1,
      'retry_after_seconds', NULL,
      'current_count', v_current_count + 1
    );
    
    INSERT INTO security_rate_limits (scope, key, count, window_start, updated_at)
    VALUES (p_scope, p_key, v_current_count + 1, NOW(), NOW())
    ON CONFLICT (scope, key) DO UPDATE
    SET count = excluded.count,
        window_start = NOW(),
        updated_at = NOW();
  END IF;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;