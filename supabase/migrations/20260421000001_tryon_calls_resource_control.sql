ALTER TABLE org_usage_daily
  ADD COLUMN IF NOT EXISTS tryon_calls BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF to_regclass('public.tryon_events') IS NOT NULL THEN
    UPDATE org_usage_daily usd
    SET tryon_calls = aggregated.tryon_calls,
        updated_at = NOW()
    FROM (
      SELECT
        org_id,
        created_at::date AS usage_date,
        COUNT(*)::BIGINT AS tryon_calls
      FROM tryon_events
      GROUP BY org_id, created_at::date
    ) AS aggregated
    WHERE usd.org_id = aggregated.org_id
      AND usd.usage_date = aggregated.usage_date;
  END IF;
END $$;
