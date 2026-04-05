WITH default_org AS (
  SELECT id
  FROM orgs
  WHERE slug = 'maison-elite'
  ORDER BY created_at ASC
  LIMIT 1
),
resolved_products AS (
  SELECT
    p.id AS product_id,
    COALESCE(
      (
        SELECT o.id
        FROM auth.users u
        JOIN orgs o
          ON o.slug = COALESCE(
            NULLIF(u.raw_app_meta_data ->> 'org_slug', ''),
            NULLIF(u.raw_app_meta_data ->> 'org_id', ''),
            NULLIF(u.raw_user_meta_data ->> 'org_slug', ''),
            NULLIF(u.raw_user_meta_data ->> 'org_id', '')
          )
        WHERE u.id = p.b2b_user_id
        LIMIT 1
      ),
      (
        SELECT om.org_id
        FROM org_members om
        WHERE om.user_id = p.b2b_user_id
        ORDER BY om.created_at ASC
        LIMIT 1
      ),
      (SELECT id FROM default_org)
    ) AS resolved_org_id
  FROM products p
  WHERE p.org_id IS NULL
),
updated AS (
  UPDATE products p
  SET org_id = rp.resolved_org_id
  FROM resolved_products rp
  WHERE p.id = rp.product_id
    AND rp.resolved_org_id IS NOT NULL
  RETURNING p.id
)
SELECT
  (SELECT COUNT(*) FROM products) AS total_products,
  (SELECT COUNT(*) FROM products WHERE org_id IS NOT NULL) AS org_id_filled,
  (SELECT COUNT(*) FROM updated) AS updated_rows,
  (SELECT COUNT(*) FROM products WHERE org_id IS NULL) AS unresolved_rows;
