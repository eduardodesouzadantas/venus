-- Self-Optimizing Margin & Limit Engine - Audit Table
-- Persists all auto-adjustment operations for traceability and compliance.

CREATE TABLE IF NOT EXISTS optimization_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'ai_tokens',
    'try_on',
    'whatsapp_message',
    'saved_result',
    'product',
    'lead'
  )),
  previous_limit BIGINT NOT NULL,
  new_limit BIGINT NOT NULL,
  factor NUMERIC(5, 2) NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'increase_limits',
    'reduce_limits',
    'throttle',
    'maintain',
    'emergency_reduce'
  )),
  reason TEXT NOT NULL,
  policy_rule_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  is_dry_run BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL DEFAULT 'system_auto_limits',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_audit_org_id ON optimization_audit (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_audit_job_id ON optimization_audit (job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_audit_resource_type ON optimization_audit (resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_audit_created_at ON optimization_audit (created_at DESC);

ALTER TABLE optimization_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Optimization audit agency read" ON optimization_audit;
CREATE POLICY "Optimization audit agency read"
  ON optimization_audit FOR SELECT
  USING (tenant.is_agency_user());

DROP POLICY IF EXISTS "Optimization audit system write" ON optimization_audit;
CREATE POLICY "Optimization audit system write"
  ON optimization_audit FOR ALL
  USING (created_by = 'system_auto_limits' OR tenant.is_agency_user())
  WITH CHECK (created_by = 'system_auto_limits' OR tenant.is_agency_user());

GRANT SELECT ON optimization_audit TO authenticated;
GRANT SELECT, INSERT ON optimization_audit TO service_role;