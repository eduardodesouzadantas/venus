-- WhatsApp Continuity Metrics View
-- Measures the impact of Smart Replies on conversation flow.

CREATE OR REPLACE VIEW whatsapp_continuation_view AS
WITH base_metrics AS (
  SELECT 
    org_slug,
    smart_reply_angle,
    COUNT(*) FILTER (WHERE event_type = 'smart_reply_sent') as total_sent,
    COUNT(*) FILTER (WHERE event_type = 'customer_replied_after_smart_reply') as total_replies,
    AVG((payload->>'reply_delay_min')::FLOAT) FILTER (WHERE event_type = 'customer_replied_after_smart_reply') as avg_reply_delay_min
  FROM whatsapp_events
  WHERE smart_reply_angle IS NOT NULL
  GROUP BY org_slug, smart_reply_angle
)
SELECT
  org_slug,
  smart_reply_angle,
  total_sent,
  total_replies,
  
  -- Continuation Rate (Reply / Sent)
  CASE 
    WHEN total_sent > 0 
    THEN (total_replies::FLOAT / total_sent) * 100 
    ELSE 0 
  END as customer_reply_rate,
  
  ROUND(avg_reply_delay_min::numeric, 2) as avg_reply_delay_min
FROM base_metrics;

ALTER VIEW whatsapp_continuation_view SET (security_invoker = true);

-- Permissions
GRANT SELECT ON whatsapp_continuation_view TO anon, authenticated;

CREATE OR REPLACE VIEW whatsapp_smart_reply_continuation_metrics AS
SELECT *
FROM whatsapp_continuation_view;

ALTER VIEW whatsapp_smart_reply_continuation_metrics SET (security_invoker = true);

GRANT SELECT ON whatsapp_smart_reply_continuation_metrics TO anon, authenticated;
