import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWhatsAppFollowUpMessagePreview,
  buildWhatsAppFollowUpPresentation,
  generateWhatsAppFollowUpMessage,
  type FollowUpContext,
} from "@/lib/whatsapp/look-followup";
import { sendMetaWhatsAppTextMessage } from "@/lib/whatsapp/meta";

export const dynamic = "force-dynamic";

/**
 * Webhook para processar mensagens de follow-up de looks
 * Endpoint: /api/whatsapp/look-followup
 * 
 * Este endpoint é chamado quando o cliente responde no WhatsApp
 * após receber um look. A Venus responde automaticamente oferecendo
 * mais opções e aumentando o ticket médio.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Extrair dados do webhook do WhatsApp
    const {
      orgId,
      conversationId,
      customerPhone,
      customerName,
      message,
      messageType = 'text',
      leadId,
    } = body;
    
    if (!orgId || !customerPhone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const admin = createAdminClient();
    
    // Buscar contexto da conversa
    const { data: conversation } = await admin
      .from('whatsapp_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    // Buscar perfil do lead
    const { data: lead } = await admin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    
    // Buscar último look enviado
    const { data: lastLookInteraction } = await admin
      .from('look_composition_interactions')
      .select('*, look_compositions(*)')
      .eq('lead_id', leadId)
      .eq('interaction_type', 'whatsapp_click')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Buscar histórico de looks vistos
    const { data: viewedLooksData } = await admin
      .from('look_composition_interactions')
      .select('look_composition_id')
      .eq('lead_id', leadId)
      .eq('interaction_type', 'view');
    
    const viewedLooks = viewedLooksData?.map(v => v.look_composition_id) || [];
    
    // Buscar looks comprados
    const { data: purchasedLooksData } = await admin
      .from('look_composition_conversions')
      .select('look_composition_id')
      .eq('lead_id', leadId)
      .eq('status', 'confirmed');
    
    const purchasedLooks = purchasedLooksData?.map(p => p.look_composition_id) || [];
    
    // Contar mensagens na conversa
    const { count: messageCount } = await admin
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);
    
    // Extrair dados do perfil do lead
    const leadContext = lead?.context as Record<string, unknown> || {};
    
    // Montar contexto para follow-up
    const followUpContext: FollowUpContext = {
      orgId,
      leadId,
      conversationId,
      customerName: customerName || lead?.name,
      customerPhone,
      essenceLabel: leadContext.essence as string,
      paletteFamily: leadContext.palette as string,
      colorSeason: leadContext.colorSeason as string,
      bodyFit: leadContext.bodyFit as string,
      styleDirection: leadContext.styleDirection as string,
      imageGoal: leadContext.imageGoal as string,
      viewedLooks,
      purchasedLooks,
      lastLookId: lastLookInteraction?.look_composition_id,
      messageCount: messageCount || 0,
      lastMessageAt: conversation?.last_message_at,
    };
    
    // Analisar intenção da mensagem do cliente
    const intention = analyzeMessageIntention(message);
    const basePresentation = buildWhatsAppFollowUpPresentation(
      followUpContext,
      [],
      { sourceLabel: null, explicit: false },
    );
    
    let responseMessage: string;
    let suggestions: unknown[] = [];
    let presentation: unknown = basePresentation;
    
    switch (intention.type) {
      case 'purchase':
        // Cliente quer comprar - confirmar pedido
        responseMessage = generatePurchaseConfirmation(intention.lookNumber, followUpContext);
        
        // Registrar conversão
        if (lastLookInteraction?.look_composition_id) {
          await admin.from('look_composition_conversions').insert({
            look_composition_id: lastLookInteraction.look_composition_id,
            lead_id: leadId,
            purchased_product_ids: [], // Preencher com produtos do look
            source: 'whatsapp',
            whatsapp_conversation_id: conversationId,
          });
        }
        break;
        
      case 'more_options':
        // Cliente quer mais opções - gerar follow-up
        const followUp = await generateWhatsAppFollowUpMessage(followUpContext);
        presentation = buildWhatsAppFollowUpPresentation(
          followUpContext,
          followUp.suggestions,
          { sourceLabel: null, explicit: false },
        );
        responseMessage = buildWhatsAppFollowUpMessagePreview(
          followUpContext,
          presentation as ReturnType<typeof buildWhatsAppFollowUpPresentation>,
        );
        suggestions = followUp.suggestions;
        break;
        
      case 'question':
        // Cliente tem dúvida - responder com base no contexto
        responseMessage = generateAnswerToQuestion(message, followUpContext);
        break;
        
      case 'price_inquiry':
        // Cliente perguntou preço
        responseMessage = generatePriceResponse(lastLookInteraction?.look_compositions, followUpContext);
        break;
        
      case 'availability':
        // Cliente perguntou disponibilidade
        responseMessage = generateAvailabilityResponse(lastLookInteraction?.look_compositions, followUpContext);
        break;
        
      default:
        // Resposta padrão com mais opções
        const defaultFollowUp = await generateWhatsAppFollowUpMessage(followUpContext);
        presentation = buildWhatsAppFollowUpPresentation(
          followUpContext,
          defaultFollowUp.suggestions,
          { sourceLabel: null, explicit: false },
        );
        responseMessage = buildWhatsAppFollowUpMessagePreview(
          followUpContext,
          presentation as ReturnType<typeof buildWhatsAppFollowUpPresentation>,
        );
        suggestions = defaultFollowUp.suggestions;
    }
    
    // Buscar credenciais do Meta
    const integrationAdmin = createAdminClient();
    const { data: integration } = await integrationAdmin
      .from('meta_whatsapp_integrations')
      .select('*')
      .eq('org_id', orgId)
      .single();
    
    if (!integration) {
      throw new Error("Meta WhatsApp not integrated");
    }
    
    // Enviar resposta via WhatsApp
    await sendMetaWhatsAppTextMessage({
      accessToken: integration.access_token_encrypted, // Precisa descriptografar
      phoneNumberId: integration.phone_number_id,
      to: customerPhone,
      text: responseMessage,
    });
    
    // Registrar resposta no banco
    await integrationAdmin.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      content: responseMessage,
      message_type: 'text',
      metadata: {
        follow_up: true,
        suggestions_count: suggestions.length,
        intention: intention.type,
        presentation,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: responseMessage,
      intention: intention.type,
      suggestions_count: suggestions.length,
      presentation,
    });
    
  } catch (error) {
    console.error("[whatsapp/look-followup] Error:", error);
    return NextResponse.json(
      { error: "Failed to process follow-up" },
      { status: 500 }
    );
  }
}

// Analisar intenção da mensagem do cliente
function analyzeMessageIntention(message: string): { type: string; lookNumber?: number } {
  const lowerMessage = message.toLowerCase();
  
  // Padrões de compra
  const purchasePatterns = [
    /quero (comprar|esse|essa|o look|a opção)/,
    /vou levar/,
    /fechado/,
    /confirmo/,
    /\b(ok|okay|beleza|perfeito)\b/,
    /\b(1|2|3|4|5)\b/, // Número do look
  ];
  
  for (const pattern of purchasePatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      // Extrair número do look se houver
      const numberMatch = lowerMessage.match(/\b([1-5])\b/);
      return {
        type: 'purchase',
        lookNumber: numberMatch ? parseInt(numberMatch[1]) : undefined,
      };
    }
  }
  
  // Mais opções
  const moreOptionsPatterns = [
    /mais opções/,
    /tem (outro|outra)/,
    /algo diferente/,
    /não gostei/,
    /outras cores/,
    /mais looks/,
  ];
  
  if (moreOptionsPatterns.some(p => p.test(lowerMessage))) {
    return { type: 'more_options' };
  }
  
  // Pergunta sobre preço
  const pricePatterns = [
    /quanto (custa|é|fica)/,
    /qual (o preço|valor)/,
    /preço/,
    /desconto/,
    /parcela/,
  ];
  
  if (pricePatterns.some(p => p.test(lowerMessage))) {
    return { type: 'price_inquiry' };
  }
  
  // Disponibilidade
  const availabilityPatterns = [
    /tem (disponível|estoque)/,
    /tamanho/,
    /qual tamanho/,
    /tem na cor/,
  ];
  
  if (availabilityPatterns.some(p => p.test(lowerMessage))) {
    return { type: 'availability' };
  }
  
  // Pergunta geral
  const questionPatterns = [/[?]/, /como/, /qual/, /onde/, /quando/];
  
  if (questionPatterns.some(p => p.test(lowerMessage))) {
    return { type: 'question' };
  }
  
  return { type: 'unknown' };
}

// Geradores de resposta
function generatePurchaseConfirmation(lookNumber: number | undefined, context: FollowUpContext): string {
  const lines: string[] = [];
  
  lines.push(`Perfeito${context.customerName ? `, ${context.customerName}` : ''}! 🎉`);
  lines.push('');
  
  if (lookNumber) {
    lines.push(`Vou separar a opção ${lookNumber} para você.`);
  } else {
    lines.push('Vou separar tudo para você.');
  }
  
  lines.push('');
  lines.push('Para finalizar seu pedido, preciso confirmar:');
  lines.push('');
  lines.push('1️⃣ Tamanho desejado');
  lines.push('2️⃣ Endereço de entrega');
  lines.push('3️⃣ Forma de pagamento (PIX, cartão, boleto)');
  lines.push('');
  lines.push('Pode me passar essas informações?');
  
  return lines.join('\n');
}

function generateAnswerToQuestion(message: string, context: FollowUpContext): string {
  // Respostas pré-programadas para dúvidas comuns
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('trocar') || lowerMessage.includes('devolver')) {
    return `Claro! Você tem até 7 dias para trocar ou devolver qualquer peça. A gente quer que você ame seu look! 💕\n\nQualquer dúvida sobre o processo, é só me perguntar.`;
  }
  
  if (lowerMessage.includes('entrega') || lowerMessage.includes('frete')) {
    return `Entregamos em todo o Brasil! 🚚\n\n• Capitais: 3-5 dias úteis\n• Interior: 5-8 dias úteis\n• Frete grátis acima de R$ 299\n\nQuer que eu calcule o frete para seu CEP?`;
  }
  
  if (lowerMessage.includes('pagamento') || lowerMessage.includes('parcelar')) {
    return `Aceitamos várias formas de pagamento:\n\n💳 Cartão de crédito (até 12x)\n💳 Cartão de débito\n💠 PIX (5% de desconto)\n📄 Boleto bancário\n\nQual prefere?`;
  }
  
  // Resposta genérica
  return `Entendi! Deixa eu ver como posso ajudar...\n\nEnquanto isso, que tal eu montar mais algumas opções de looks para você? Posso buscar peças em outras cores ou estilos. ✨`;
}

function generatePriceResponse(look: unknown, context: FollowUpContext): string {
  if (!look) {
    return `Os valores variam de acordo com as peças. Posso montar looks em diferentes faixas de preço para você.\n\nQual seu orçamento aproximado?`;
  }
  
  const lookData = look as Record<string, unknown>;
  const totalPrice = lookData.total_price as number;
  
  const lines: string[] = [];
  lines.push(`O look completo fica em torno de R$ ${totalPrice?.toFixed(2) || 'consultar'}. 💰`);
  lines.push('');
  lines.push('Mas tenho uma surpresa! 🎁');
  lines.push('');
  lines.push('Se você levar o look completo hoje, posso oferecer:');
  lines.push('• 10% de desconto no valor total');
  lines.push('• Ou parcelamento em até 12x sem juros');
  lines.push('• Frete grátis');
  lines.push('');
  lines.push('Qual opção prefere?');
  
  return lines.join('\n');
}

function generateAvailabilityResponse(look: unknown, context: FollowUpContext): string {
  return `Deixa eu verificar a disponibilidade para você... ⏳\n\nEnquanto isso, posso já separar essas peças? Assim garantimos que ninguém leva antes! 😊\n\nMe confirma o tamanho que você usa?`;
}
