-- Merchant groups / branches
-- Supports one agency owning multiple merchant branches under a shared group.

CREATE TABLE IF NOT EXISTS merchant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES merchant_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_name TEXT;

CREATE INDEX IF NOT EXISTS idx_merchant_groups_org_id ON merchant_groups (org_id);
CREATE INDEX IF NOT EXISTS idx_merchant_groups_owner_user_id ON merchant_groups (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_orgs_group_id ON orgs (group_id);

CREATE OR REPLACE FUNCTION tenant.current_agency_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'org_id',
      auth.jwt() -> 'app_metadata' ->> 'orgId',
      auth.jwt() -> 'user_metadata' ->> 'org_id',
      auth.jwt() -> 'user_metadata' ->> 'orgId'
    ),
    ''
  )::UUID;
$$;

ALTER TABLE merchant_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_groups_select ON merchant_groups;
CREATE POLICY merchant_groups_select
  ON merchant_groups
  FOR SELECT
  TO authenticated
  USING (org_id = tenant.current_agency_org_id());

DROP POLICY IF EXISTS merchant_groups_insert ON merchant_groups;
CREATE POLICY merchant_groups_insert
  ON merchant_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = tenant.current_agency_org_id());

DROP POLICY IF EXISTS merchant_groups_update ON merchant_groups;
CREATE POLICY merchant_groups_update
  ON merchant_groups
  FOR UPDATE
  TO authenticated
  USING (org_id = tenant.current_agency_org_id())
  WITH CHECK (org_id = tenant.current_agency_org_id());

DROP POLICY IF EXISTS merchant_groups_delete ON merchant_groups;
CREATE POLICY merchant_groups_delete
  ON merchant_groups
  FOR DELETE
  TO authenticated
  USING (org_id = tenant.current_agency_org_id());
