/**
 * WhatsApp integration for Look Compositions
 * Gera mensagens formatadas para envio de looks completos
 */

import type { LookComposition } from "./engine";
import type { SavedLookComposition } from "./db";

export interface WhatsAppLookPayload {
  look: LookComposition | SavedLookComposition;
  customerName?: string;
  customerPhone?: string;
  storeName: string;
  storePhone: string;
  resultUrl?: string;
  tryOnImageUrl?: string;
}

export function generateLookWhatsAppMessage(payload: WhatsAppLookPayload): string {
  const { look, customerName, storeName, resultUrl, tryOnImageUrl } = payload;
  
  const lines: string[] = [];
  
  // Saudação personalizada com tom de personal stylist
  if (customerName) {
    lines.push(`Oi, ${customerName}! 👋`);
  } else {
    lines.push(`Oi! 👋`);
  }
  
  lines.push('');
  lines.push(`Aqui é a Venus, sua stylist da ${storeName}.`);
  lines.push('');
  lines.push(`Montei um look exclusivo para você:`);
  lines.push(`*${look.name}*`);
  lines.push('');
  
  // Lista de itens com emojis
  lines.push('👗 *Peça principal:*');
  lines.push(`   ${look.anchorPiece.name}`);
  lines.push('');
  
  if (look.supportPieces.length > 0) {
    lines.push('✨ *Combinações:*');
    for (const piece of look.supportPieces) {
      lines.push(`   • ${piece.name}`);
    }
    lines.push('');
  }
  
  if (look.accessories.length > 0) {
    lines.push('💎 *Acessórios:*');
    for (const accessory of look.accessories) {
      lines.push(`   • ${accessory.name}`);
    }
    lines.push('');
  }
  
  // Total estimado (se houver)
  if (look.totalPrice && look.totalPrice > 0) {
    lines.push(`💰 *Investimento:* R$ ${look.totalPrice.toFixed(2)}`);
    lines.push('');
  }
  
  // Referência ao try-on
  if (tryOnImageUrl) {
    lines.push('📸 *Seu provador virtual:*');
    lines.push(tryOnImageUrl);
    lines.push('');
  }
  
  // Link do resultado
  if (resultUrl) {
    lines.push(`🔗 *Sua consultoria completa:*`);
    lines.push(resultUrl);
    lines.push('');
  }
  
  // CTA com opções numeradas
  lines.push('O que achou?');
  lines.push('');
  lines.push('1️⃣ *Quero esse look!* (separo tudo para você)');
  lines.push('2️⃣ *Ver mais opções* (tenho outros looks incríveis)');
  lines.push('3️⃣ *Tirar dúvidas* (tamanho, cor, preço)');
  lines.push('');
  lines.push('É só responder com o número! ✨');
  
  return lines.join('\n');
}

export function generateLookShareMessage(payload: {
  look: LookComposition | SavedLookComposition;
  storeName: string;
  refCode?: string;
  resultUrl?: string;
}): string {
  const { look, storeName, refCode, resultUrl } = payload;
  
  const lines: string[] = [];
  
  lines.push(`✨ Acabei de montar um look incrível na ${storeName}!`);
  lines.push('');
  lines.push(`*${look.name}*`);
  lines.push('');
  lines.push('Itens do look:');
  lines.push(`• ${look.anchorPiece.name}`);
  
  for (const piece of look.supportPieces.slice(0, 2)) {
    lines.push(`• ${piece.name}`);
  }
  
  if (look.accessories.length > 0) {
    lines.push(`• ${look.accessories[0].name}`);
  }
  
  lines.push('');
  
  if (resultUrl) {
    lines.push(`Veja minha consultoria completa: ${resultUrl}`);
  }
  
  if (refCode) {
    lines.push(`Quer experimentar? Use meu código: ${refCode}`);
  }
  
  lines.push('');
  lines.push(`@${storeName.replace(/\s+/g, '')} @InovaCortex`);
  
  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export function openWhatsApp(phone: string, message: string): void {
  const url = buildWhatsAppUrl(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Função para gerar resumo do look para o lojista
export function generateLookSummaryForMerchant(
  look: LookComposition | SavedLookComposition,
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  }
): string {
  const lines: string[] = [];
  
  lines.push('🛍️ *NOVO PEDIDO DE LOOK*');
  lines.push('');
  
  if (customerInfo?.name) {
    lines.push(`*Cliente:* ${customerInfo.name}`);
  }
  if (customerInfo?.phone) {
    lines.push(`*Telefone:* ${customerInfo.phone}`);
  }
  
  lines.push('');
  lines.push(`*Look:* ${look.name}`);
  lines.push('');
  lines.push('*ITENS:*');
  
  // Âncora
  lines.push(`1. ${look.anchorPiece.name}`);
  if (look.anchorPiece.external_url) {
    lines.push(`   Link: ${look.anchorPiece.external_url}`);
  }
  
  // Suportes
  look.supportPieces.forEach((piece, idx) => {
    lines.push(`${idx + 2}. ${piece.name}`);
    if (piece.external_url) {
      lines.push(`   Link: ${piece.external_url}`);
    }
  });
  
  // Acessórios
  look.accessories.forEach((piece, idx) => {
    lines.push(`${look.supportPieces.length + idx + 2}. ${piece.name}`);
    if (piece.external_url) {
      lines.push(`   Link: ${piece.external_url}`);
    }
  });
  
  lines.push('');
  
  if (look.totalPrice && look.totalPrice > 0) {
    lines.push(`*Valor estimado:* R$ ${look.totalPrice.toFixed(2)}`);
  }
  
  return lines.join('\n');
}
