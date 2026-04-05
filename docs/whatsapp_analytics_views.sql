-- WhatsApp Smart Reply Analytics Views
-- This file creates the analytical layer for AI-assisted communication metrics.

-- 1. Detailed Metrics per Angle and Conversation
CREATE OR REPLACE VIEW whatsapp_smart_reply_metrics AS
SELECT 
  org_slug,
  conversation_id,
  smart_reply_angle,
  COUNT(*) FILTER (WHERE event_type = 'smart_reply_shown') as shown_count,
  COUNT(*) FILTER (WHERE event_type = 'smart_reply_clicked') as clicked_count,
  COUNT(*) FILTER (WHERE event_type = 'smart_reply_applied') as applied_count,
  COUNT(*) FILTER (WHERE event_type = 'smart_reply_sent') as sent_count,
  
  -- CTR: Clicked / Shown
  CASE 
    WHEN COUNT(*) FILTER (WHERE event_type = 'smart_reply_shown') > 0 
    THEN (COUNT(*) FILTER (WHERE event_type = 'smart_reply_clicked')::FLOAT / COUNT(*) FILTER (WHERE event_type = 'smart_reply_shown')) * 100 
    ELSE 0 
  END as click_through_rate,

  -- Apply Rate: Applied / Clicked
  CASE 
    WHEN COUNT(*) FILTER (WHERE event_type = 'smart_reply_clicked') > 0 
    THEN (COUNT(*) FILTER (WHERE event_type = 'smart_reply_applied')::FLOAT / COUNT(*) FILTER (WHERE event_type = 'smart_reply_clicked')) * 100 
    ELSE 0 
  END as apply_rate,

  -- Sent Rate: Sent / Applied (Commitment to the AI suggestion)
  CASE 
    WHEN COUNT(*) FILTER (WHERE event_type = 'smart_reply_applied') > 0 
    THEN (COUNT(*) FILTER (WHERE event_type = 'smart_reply_sent')::FLOAT / COUNT(*) FILTER (WHERE event_type = 'smart_reply_applied')) * 100 
    ELSE 0 
  END as sent_rate

FROM whatsapp_events
WHERE smart_reply_angle IS NOT NULL
GROUP BY org_slug, conversation_id, smart_reply_angle;

ALTER VIEW whatsapp_smart_reply_metrics SET (security_invoker = true);

-- 2. Organization Summary View
CREATE OR REPLACE VIEW whatsapp_smart_reply_org_summary AS
WITH angle_totals AS (
  SELECT 
    org_slug,
    smart_reply_angle,
    SUM(shown_count) as total_shown,
    SUM(clicked_count) as total_clicked,
    SUM(applied_count) as total_applied,
    SUM(sent_count) as total_sent,
    CASE 
      WHEN SUM(shown_count) > 0 
      THEN (SUM(clicked_count)::FLOAT / SUM(shown_count)) * 100 
      ELSE 0 
    END as click_through_rate,
    CASE 
      WHEN SUM(clicked_count) > 0 
      THEN (SUM(applied_count)::FLOAT / SUM(clicked_count)) * 100 
      ELSE 0 
    END as apply_rate,
    CASE 
      WHEN SUM(applied_count) > 0 
      THEN (SUM(sent_count)::FLOAT / SUM(applied_count)) * 100 
      ELSE 0 
    END as sent_rate
  FROM whatsapp_smart_reply_metrics
  GROUP BY org_slug, smart_reply_angle
)
SELECT 
  org_slug,
  SUM(total_shown) as total_shown,
  SUM(total_clicked) as total_clicked,
  SUM(total_applied) as total_applied,
  SUM(total_sent) as total_sent,
  
  -- Global Engagement Rate
  CASE 
    WHEN SUM(total_shown) > 0 
    THEN (SUM(total_sent)::FLOAT / SUM(total_shown)) * 100 
    ELSE 0 
  END as global_conversion_assisted_rate,

  -- Identifying the Top Performing Angle per Org
  (
    SELECT smart_reply_angle 
    FROM angle_totals m2 
    WHERE m2.org_slug = m1.org_slug 
    ORDER BY m2.sent_rate DESC, m2.total_sent DESC 
    LIMIT 1
  ) as top_performing_angle

FROM angle_totals m1
GROUP BY org_slug;

ALTER VIEW whatsapp_smart_reply_org_summary SET (security_invoker = true);

-- Permissions
GRANT SELECT ON whatsapp_smart_reply_metrics TO anon, authenticated;
GRANT SELECT ON whatsapp_smart_reply_org_summary TO anon, authenticated;
