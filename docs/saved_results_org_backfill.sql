-- 1) Backfill by tenant payload stored in saved_results.payload
UPDATE saved_results sr
SET org_id = o.id
FROM orgs o
WHERE sr.org_id IS NULL
  AND (
    COALESCE(
      NULLIF(sr.payload->'tenant'->>'orgSlug', ''),
      NULLIF(sr.payload->'tenant'->>'orgId', ''),
      NULLIF(sr.payload->>'orgSlug', ''),
      NULLIF(sr.payload->>'orgId', '')
    ) = o.slug
    OR COALESCE(
      NULLIF(sr.payload->'tenant'->>'orgId', ''),
      NULLIF(sr.payload->>'org_id', '')
    ) = o.id::text
  );

-- 2) Backfill by saved email -> auth.users -> orgs metadata
UPDATE saved_results sr
SET org_id = o.id
FROM auth.users u
JOIN orgs o
  ON o.slug = COALESCE(
    NULLIF(u.raw_app_meta_data->>'org_slug', ''),
    NULLIF(u.raw_app_meta_data->>'org_id', ''),
    NULLIF(u.raw_user_meta_data->>'org_slug', ''),
    NULLIF(u.raw_user_meta_data->>'org_id', '')
  )
WHERE sr.org_id IS NULL
  AND sr.user_email IS NOT NULL
  AND lower(u.email) = lower(sr.user_email);

-- 3) Backfill by saved email -> auth.users -> org_members
UPDATE saved_results sr
SET org_id = m.org_id
FROM auth.users u
JOIN org_members m ON m.user_id = u.id
WHERE sr.org_id IS NULL
  AND sr.user_email IS NOT NULL
  AND lower(u.email) = lower(sr.user_email);

-- 4) Transitional bridge: if the environment still has exactly one active org,
-- use it to assign legacy rows that have no owner signal.
WITH active_org_count AS (
  SELECT COUNT(*) AS total
  FROM orgs
  WHERE status = 'active' AND NOT kill_switch
),
single_active_org AS (
  SELECT id
  FROM orgs
  WHERE status = 'active' AND NOT kill_switch
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE saved_results sr
SET org_id = sao.id
FROM active_org_count aoc, single_active_org sao
WHERE sr.org_id IS NULL
  AND aoc.total = 1;

-- 5) Keep payload tenant metadata aligned with the canonical org_id.
UPDATE saved_results sr
SET payload = jsonb_set(
  COALESCE(sr.payload, '{}'::jsonb),
  '{tenant}',
  jsonb_build_object(
    'orgId', sr.org_id::text,
    'orgSlug', o.slug,
    'source', 'saved_results_backfill'
  ),
  true
)
FROM orgs o
WHERE sr.org_id IS NOT NULL
  AND o.id = sr.org_id
  AND (sr.payload->'tenant' IS NULL OR sr.payload->'tenant' = 'null'::jsonb);

SELECT
  COUNT(*) AS total_saved_results,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) AS org_id_filled,
  COUNT(*) FILTER (WHERE org_id IS NULL) AS org_id_missing
FROM saved_results;

SELECT o.slug, COUNT(sr.*) AS saved_results
FROM orgs o
LEFT JOIN saved_results sr ON sr.org_id = o.id
GROUP BY o.slug
ORDER BY o.slug;
