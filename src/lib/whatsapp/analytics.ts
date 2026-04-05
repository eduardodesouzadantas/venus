import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";
import { SmartReplySuggestion, SmartReplyAngle } from "@/types/whatsapp";

const supabase = createWhatsAppClient();

export type WhatsAppEventType = 
  | 'smart_reply_shown' 
  | 'smart_reply_clicked' 
  | 'smart_reply_applied' 
  | 'smart_reply_sent' 
  | 'customer_replied_after_smart_reply' 
  | 'smart_reply_assisted_conversion';

interface TrackWhatsAppInput {
  org_slug: string;
  conversation_id: string;
  event_type: WhatsAppEventType;
  message_id?: string;
  dedupe_key?: string;
  smart_reply?: SmartReplySuggestion | {
    id: string;
    angle: SmartReplyAngle;
    label: string;
    confidence?: number;
  };
  payload?: any;
}

export const trackWhatsAppEvent = async (input: TrackWhatsAppInput) => {
  if (!input.org_slug || !input.conversation_id) return;

  const row = {
    org_slug: input.org_slug,
    conversation_id: input.conversation_id,
    event_type: input.event_type,
    message_id: input.message_id,
    dedupe_key: input.dedupe_key,
    smart_reply_id: input.smart_reply?.id,
    smart_reply_angle: input.smart_reply?.angle,
    smart_reply_label: input.smart_reply?.label,
    smart_reply_confidence: input.smart_reply?.confidence,
    payload: input.payload || {}
  };

  const query = input.dedupe_key
    ? supabase.from('whatsapp_events').upsert(row, { onConflict: 'dedupe_key' })
    : supabase.from('whatsapp_events').insert(row);

  const { error } = await query;

  if (error) {
    console.error(`[ANALYTICS] Error tracking ${input.event_type}:`, error);
  } else {
    // console.log(`[ANALYTICS] Tracked: ${input.event_type} for conv ${input.conversation_id}`);
  }
};
