-- Fix: garantir que a view whatsapp_smart_reply_metrics existe em producao
-- Rodar no Supabase SQL Editor se a migration nao tiver sido aplicada

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
