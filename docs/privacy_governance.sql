CREATE TABLE IF NOT EXISTS privacy_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id TEXT,
  org_slug TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'data_export_requested',
    'data_export_completed',
    'tenant_delete_requested',
    'tenant_delete_completed',
    'tenant_delete_failed'
  )),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_events_org_id ON privacy_audit_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_events_org_slug ON privacy_audit_events (org_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_events_action ON privacy_audit_events (action, created_at DESC);

ALTER TABLE privacy_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage privacy audit events" ON privacy_audit_events;
CREATE POLICY "Agency can manage privacy audit events"
  ON privacy_audit_events
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Merchant can read privacy audit events for org" ON privacy_audit_events;
CREATE POLICY "Merchant can read privacy audit events for org"
  ON privacy_audit_events
  FOR SELECT
  USING (
    tenant.is_merchant_user()
    AND org_slug = tenant.current_org_slug()
  );

GRANT SELECT, INSERT ON privacy_audit_events TO authenticated;

ALTER TABLE saved_results
  ADD COLUMN IF NOT EXISTS data_classification TEXT NOT NULL DEFAULT 'derived',
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_saved_results_deleted_at ON saved_results (deleted_at);
CREATE INDEX IF NOT EXISTS idx_saved_results_retention_until ON saved_results (retention_until);
