/**
 * Venus AI Automation Engine.
 * Triggers re-engagement based on behavioral signals.
 */

import { generateWACopy } from "./copy";
import { UserContext } from "@/types/whatsapp";
import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";
import { hydrateWhatsAppConversationContext } from "@/lib/whatsapp/context-bridge";

const supabase = createWhatsAppClient();

export const triggerReEngagement = async (
  user: { name: string; phone: string; context: UserContext }, 
  triggerType: 'abandoned_tryon' | 'high_intent_exit' | 'bundle_hesitation'
) => {
  const hydratedContext = await hydrateWhatsAppConversationContext({
    ...user.context,
    name: user.context.name || user.name,
    phone: user.phone,
  });

  const orgSlug = hydratedContext.orgSlug || user.context.orgSlug;
  if (!orgSlug) {
    console.warn(`[AUTOMAÇÃO] Skipping re-engagement for ${user.phone} without org_slug`);
    return;
  }

  // 1. Identify or Create Conversation
  const { data: conv, error: convError } = await supabase
    .from('whatsapp_conversations')
    .select('id, status, org_slug')
    .eq('user_phone', user.phone)
    .eq('org_slug', orgSlug)
    .single();

  let conversationId: string;

  if (!conv) {
    const { data: newConv, error: createError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        org_slug: orgSlug,
        user_name: user.name,
        user_phone: user.phone,
        user_context: hydratedContext,
        status: 'ai_active',
        priority: triggerType === 'high_intent_exit' ? 'high' : 'medium'
      })
      .select()
      .single();

    if (createError) throw createError;
    conversationId = newConv.id;
  } else {
    conversationId = conv.id;
  }

  // 2. Generate Persuasive IA Copy
  const segmentKey = 
    triggerType === 'abandoned_tryon' ? 'try_on_users' : 
    triggerType === 'high_intent_exit' ? 'alta_intencao' : 'inativos';
    
  const copy = generateWACopy('cross_sell', segmentKey as any, 'premium');

  // 3. Send AI Message
  const text = `${copy.headline}: ${copy.body} ${copy.cta}`;
  
  const { error: msgError } = await supabase
    .from('whatsapp_messages')
    .insert({
      org_slug: orgSlug,
      conversation_id: conversationId,
      sender: 'ai',
      text,
      type: 'text'
    });

  if (msgError) throw msgError;

  // 4. Update Conversation status
  await supabase
    .from('whatsapp_conversations')
    .update({ 
      last_message: text, 
      last_updated: new Date().toISOString() 
    })
    .eq('id', conversationId)
    .eq('org_slug', orgSlug);

  console.log(`[AUTOMAÇÃO] Mensagem de reajuste enviada para ${user.phone} via ${triggerType}`);
};

/**
 * Hook-like function to be called on page exit or inactivity
 */
export const trackPotentialAbandonment = (stats: any, userData: any) => {
  if (!userData?.phone || !userData?.orgSlug) return;

  // Logic: View count > 5 or Try-on used but no final CTA click
  const totalViews = Object.values(stats.looks || {}).reduce((acc: number, curr: any) => acc + (curr.view || 0), 0);
  const tryOnUsed = Object.values(stats.looks || {}).reduce((acc: number, curr: any) => acc + (curr.try_on || 0), 0);

  if (tryOnUsed > 0 && totalViews > 3) {
     // Scenario: User tested but didn't buy
     setTimeout(() => {
        // Double check if they bought (not implemented in this mock)
       triggerReEngagement(
          { name: userData.name, phone: userData.phone, context: { ...(stats as any), orgSlug: userData.orgSlug } }, 
          'abandoned_tryon'
        );
     }, 1000 * 60 * 5); // 5 minutes lag
  }
};
