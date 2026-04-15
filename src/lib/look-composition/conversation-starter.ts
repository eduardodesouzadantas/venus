/**
 * Conversation Starter for Look Compositions
 * 
 * Inicia o fluxo de conversa no WhatsApp quando o cliente
 * clica em "Quero Esse Look", configurando o contexto para
 * follow-ups automáticos.
 */

import { createAdminClient } from "@/lib/supabase/admin";
// Nota: Em produção, integrar com API oficial do WhatsApp Business
// Por enquanto, usamos o formato de URL que abre o WhatsApp
import { generateLookWhatsAppMessage } from "./whatsapp";
import type { LookComposition } from "./engine";
import type { SavedLookComposition } from "./db";

interface StartConversationParams {
  look: LookComposition | SavedLookComposition;
  orgId: string;
  storeName: string;
  storePhone: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  resultUrl?: string;
  tryOnImageUrl?: string;
  leadId?: string;
  resultId?: string;
}

export async function startLookConversation(
  params: StartConversationParams
): Promise<{
  success: boolean;
  conversationId?: string;
  message?: string;
  error?: string;
}> {
  const admin = createAdminClient();
  
  try {
    // 1. Buscar ou criar lead
    let leadId = params.leadId;
    
    if (!leadId) {
      // Buscar lead pelo telefone
      const { data: existingLead } = await admin
        .from('leads')
        .select('id')
        .eq('org_id', params.orgId)
        .eq('phone', params.customerPhone)
        .maybeSingle();
      
      if (existingLead) {
        leadId = existingLead.id;
      } else {
        // Criar novo lead
        const { data: newLead, error: leadError } = await admin
          .from('leads')
          .insert({
            org_id: params.orgId,
            name: params.customerName || 'Cliente',
            phone: params.customerPhone,
            email: params.customerEmail,
            source: 'look_composition',
            status: 'hot',
          })
          .select()
          .single();
        
        if (leadError) throw leadError;
        leadId = newLead.id;
      }
    }
    
    // 2. Criar conversa no WhatsApp
    const { data: conversation, error: convError } = await admin
      .from('whatsapp_conversations')
      .insert({
        org_id: params.orgId,
        lead_id: leadId,
        customer_phone: params.customerPhone,
        customer_name: params.customerName,
        status: 'active',
        source: 'look_composition',
        metadata: {
          look_id: 'dbId' in params.look ? params.look.dbId : params.look.id,
          result_id: params.resultId,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();
    
    if (convError) throw convError;
    
    // 3. Gerar mensagem inicial
    const message = generateLookWhatsAppMessage({
      look: params.look,
      customerName: params.customerName,
      storeName: params.storeName,
      storePhone: params.storePhone,
      resultUrl: params.resultUrl,
      tryOnImageUrl: params.tryOnImageUrl,
    });
    
    // 4. Registrar mensagem no banco (envio real via URL do WhatsApp)
    await admin.from('whatsapp_messages').insert({
      conversation_id: conversation.id,
      direction: 'outbound',
      content: message,
      message_type: 'text',
      metadata: {
        look_composition_id: 'dbId' in params.look ? params.look.dbId : params.look.id,
        is_initial: true,
      },
    });
    
    // 5. Atualizar última mensagem na conversa
    await admin
      .from('whatsapp_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.substring(0, 100),
      })
      .eq('id', conversation.id);
    
    // 6. Registrar interação no look
    const lookId = 'dbId' in params.look ? params.look.dbId : params.look.id;
    await admin.from('look_composition_interactions').insert({
      look_composition_id: lookId,
      lead_id: leadId,
      interaction_type: 'whatsapp_click',
      source_page: params.resultUrl,
    });
    
    // 7. Agendar follow-up automático (após 2 horas se não houver resposta)
    await scheduleFollowUp(conversation.id, params.orgId, 2 * 60 * 60 * 1000); // 2 horas
    
    return {
      success: true,
      conversationId: conversation.id,
      message,
    };
    
  } catch (error) {
    console.error("[startLookConversation] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start conversation",
    };
  }
}

// Agendar follow-up automático
async function scheduleFollowUp(
  conversationId: string,
  orgId: string,
  delayMs: number
): Promise<void> {
  // Em produção, isso seria feito via queue (Bull, SQS, etc)
  // Por enquanto, usamos um timeout simples (não recomendado para produção)
  
  setTimeout(async () => {
    try {
      const admin = createAdminClient();
      
      // Verificar se houve resposta do cliente
      const { data: lastMessage } = await admin
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Se a última mensagem for do sistema (outbound), enviar follow-up
      if (lastMessage && lastMessage.direction === 'outbound') {
        // Chamar API de follow-up
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/look-followup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            orgId,
            isFollowUp: true,
            previousMessageId: lastMessage.id,
          }),
        });
      }
    } catch (err) {
      console.error("[scheduleFollowUp] Error:", err);
    }
  }, delayMs);
}

// Função para reengajar cliente inativo
export async function reengageInactiveConversation(
  conversationId: string,
  orgId: string
): Promise<void> {
  const admin = createAdminClient();
  
  // Buscar contexto da conversa
  const { data: conversation } = await admin
    .from('whatsapp_conversations')
    .select('*, leads(*)')
    .eq('id', conversationId)
    .single();
  
  if (!conversation) return;
  
  // Verificar se está inativo há mais de 24h
  const lastMessageAt = new Date(conversation.last_message_at || conversation.created_at);
  const hoursInactive = (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursInactive < 24) return;
  
  // Mensagem de reengajamento
  const reengageMessages = [
    `Oi${conversation.customer_name ? `, ${conversation.customer_name}` : ''}! 👋\n\nVi que você gostou dos looks que montei. Ainda está interessada?\n\nTenho novidades que acabaram de chegar e combinam com seu perfil! ✨\n\nQuer ver?`,
    
    `Ei${conversation.customer_name ? `, ${conversation.customer_name}` : ''}! 💫\n\nPassando para avisar que algumas peças que você viu estão com poucas unidades.\n\nQuer que eu reserve para você?`,
    
    `Oi! 🛍️\n\nPreparando looks exclusivos para clientes VIP como você.\n\nTenho condições especiais para fechar hoje. Posso mostrar?`,
  ];
  
  const message = reengageMessages[Math.floor(Math.random() * reengageMessages.length)];
  
  // Nota: Em produção, enviar via API do WhatsApp Business
  // Por enquanto, apenas registramos no banco
  
  // Registrar
  await admin.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    content: message,
    message_type: 'text',
    metadata: { reengagement: true },
  });
}
