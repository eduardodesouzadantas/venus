WITH merchant_users AS (
  SELECT
    id AS user_id,
    email,
    COALESCE(
      NULLIF(raw_app_meta_data ->> 'org_slug', ''),
      NULLIF(raw_app_meta_data ->> 'org_id', ''),
      NULLIF(raw_user_meta_data ->> 'org_slug', ''),
      NULLIF(raw_user_meta_data ->> 'org_id', ''),
      'maison-elite'
    ) AS org_slug,
    COALESCE(
      NULLIF(raw_user_meta_data ->> 'name', ''),
      split_part(email, '@', 1),
      'merchant'
    ) AS org_name,
    COALESCE(
      NULLIF(raw_app_meta_data ->> 'role', ''),
      NULLIF(raw_user_meta_data ->> 'role', ''),
      'merchant_owner'
    ) AS role
  FROM auth.users
  WHERE COALESCE(raw_app_meta_data ->> 'role', raw_user_meta_data ->> 'role') LIKE 'merchant_%'
),
seeded_orgs AS (
  INSERT INTO orgs (slug, name, status, kill_switch, plan_id, limits, owner_user_id)
  SELECT DISTINCT ON (org_slug)
    org_slug,
    org_name,
    'active',
    FALSE,
    'starter',
    '{"ai_tokens_monthly":250000,"whatsapp_messages_daily":1000,"products":500,"leads":10000}'::jsonb,
    user_id
  FROM merchant_users
  ORDER BY org_slug, user_id
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    owner_user_id = COALESCE(orgs.owner_user_id, EXCLUDED.owner_user_id)
  RETURNING id, slug
),
seeded_members AS (
  INSERT INTO org_members (org_id, user_id, role, status)
  SELECT
    o.id,
    mu.user_id,
    mu.role,
    'active'
  FROM merchant_users mu
  JOIN seeded_orgs o ON o.slug = mu.org_slug
  ON CONFLICT (org_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active'
  RETURNING org_id, user_id
),
seeded_usage AS (
  INSERT INTO org_usage_daily (
    org_id,
    usage_date,
    ai_tokens,
    ai_requests,
    messages_sent,
    events_count,
    revenue_cents,
    cost_cents
  )
  SELECT
    o.id,
    CURRENT_DATE,
    0,
    0,
    0,
    0,
    0,
    0
  FROM merchant_users mu
  JOIN seeded_orgs o ON o.slug = mu.org_slug
  ON CONFLICT (org_id, usage_date) DO NOTHING
  RETURNING org_id, usage_date
),
seeded_events AS (
  INSERT INTO tenant_events (
    org_id,
    actor_user_id,
    event_type,
    event_source,
    dedupe_key,
    payload
  )
  SELECT
    o.id,
    mu.user_id,
    'tenant_seeded',
    'tenant_core_seed',
    'tenant_seeded:' || mu.org_slug || ':' || mu.user_id,
    jsonb_build_object(
      'org_slug', mu.org_slug,
      'org_name', mu.org_name,
      'role', mu.role
    )
  FROM merchant_users mu
  JOIN seeded_orgs o ON o.slug = mu.org_slug
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM merchant_users) AS merchant_users,
  (SELECT COUNT(*) FROM seeded_orgs) AS orgs_seeded,
  (SELECT COUNT(*) FROM seeded_members) AS members_seeded,
  (SELECT COUNT(*) FROM seeded_usage) AS usage_rows_seeded,
  (SELECT COUNT(*) FROM seeded_events) AS events_seeded;
