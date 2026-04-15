CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  body_type TEXT,
  color_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  style_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_org_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  interactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_state TEXT NOT NULL DEFAULT 'onboarding_chat',
  engagement_score INTEGER NOT NULL DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_key TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'org')),
  source TEXT NOT NULL DEFAULT 'journey',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_org_profiles_user_org ON user_org_profiles (user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_user_org_profiles_org_updated_at ON user_org_profiles (org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON user_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_org_id ON user_tags (org_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_scope ON user_tags (scope, tag);

CREATE OR REPLACE FUNCTION tenant.touch_user_journey_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_touch_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_touch_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_user_journey_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_user_org_profiles_updated_at ON user_org_profiles;
CREATE TRIGGER trigger_touch_user_org_profiles_updated_at
  BEFORE UPDATE ON user_org_profiles
  FOR EACH ROW
  EXECUTE FUNCTION tenant.touch_user_journey_updated_at();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE user_org_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE user_tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage user profiles" ON user_profiles;
CREATE POLICY "Agency can manage user profiles"
  ON user_profiles
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
CREATE POLICY "Users can manage own profile"
  ON user_profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Agency can manage user org profiles" ON user_org_profiles;
CREATE POLICY "Agency can manage user org profiles"
  ON user_org_profiles
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Users can manage own org profiles" ON user_org_profiles;
CREATE POLICY "Users can manage own org profiles"
  ON user_org_profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Agency can manage user tags" ON user_tags;
CREATE POLICY "Agency can manage user tags"
  ON user_tags
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Users can manage own tags" ON user_tags;
CREATE POLICY "Users can manage own tags"
  ON user_tags
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_org_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_tags TO authenticated;
