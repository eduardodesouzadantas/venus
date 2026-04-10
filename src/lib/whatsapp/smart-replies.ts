import { WhatsAppConversation, SmartReplySuggestion } from "@/types/whatsapp";
import {
  buildFashionConsultationSnapshot,
  buildFashionConsultativeReply,
  type FashionReplyAngle,
  type FashionReplyTone,
} from "@/lib/whatsapp/fashion-consultant";

const ANGLE_PRIORITY: FashionReplyAngle[] = ["closing", "price", "fit", "objection", "desire", "follow_up"];

export function generateSmartReplies(conversation: WhatsAppConversation): SmartReplySuggestion[] {
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  if (!lastMsg || lastMsg.sender !== "user") return [] as SmartReplySuggestion[];

  const text = lastMsg.text.toLowerCase();
  const snapshot = buildFashionConsultationSnapshot(conversation);
  const tone = getReplyTone(snapshot.intentScore);

  const isDoubtfulPrice = hasAny(text, ["quanto", "preco", "valor", "pagar", "desconto", "parcela", "custar"]);
  const isDoubtfulFit = hasAny(text, ["tamanho", "combina", "perfil", "cor", "veste", "corpo", "ombro", "cai"]);
  const isReadyToClose = hasAny(text, ["fechar", "comprar", "quero", "agora", "link", "fechamento", "manda", "pagina"]) || snapshot.intentScore > 85;
  const needsSupport = snapshot.intentScore < 45 && snapshot.tryOnCount === 0 && snapshot.viewedProductsCount === 0;

  const suggestions: SmartReplySuggestion[] = [];

  suggestions.push({
    id: isReadyToClose ? "close-strong" : "close-guided",
    label: isReadyToClose ? "Fechar com clareza" : "Conduzir para decisao",
    angle: "closing",
    text: buildFashionConsultativeReply(snapshot, "closing", tone),
    recommendedFor: isReadyToClose ? "Alta intenção" : "Avanco de funil",
    confidence: isReadyToClose ? 0.96 : 0.88,
  });

  if (isDoubtfulPrice) {
    suggestions.push({
      id: "price-objection",
      label: "Valor com criterio",
      angle: "price",
      text: buildFashionConsultativeReply(snapshot, "price", tone),
      recommendedFor: "Dúvida de preco",
      confidence: 0.93,
    });
  } else if (isDoubtfulFit) {
    suggestions.push({
      id: "fit-objection",
      label: "Caimento e segurança",
      angle: "fit",
      text: buildFashionConsultativeReply(snapshot, "fit", tone),
      recommendedFor: "Dúvida de caimento",
      confidence: 0.94,
    });
  } else {
    suggestions.push({
      id: "general-objection",
      label: needsSupport ? "Qualificar melhor" : "Quebrar insegurança",
      angle: "objection",
      text: buildFashionConsultativeReply(snapshot, "objection", tone),
      recommendedFor: needsSupport ? "Construir contexto" : "Hesitação",
      confidence: needsSupport ? 0.8 : 0.87,
    });
  }

  suggestions.push({
    id: snapshot.intentScore > 60 ? "desire-high" : "desire-consultative",
    label: snapshot.intentScore > 60 ? "Aumentar desejo" : "Dar contexto",
    angle: "desire",
    text: buildFashionConsultativeReply(snapshot, "desire", tone),
    recommendedFor: snapshot.intentScore > 60 ? "Urgência estética" : "Construção de valor",
    confidence: snapshot.intentScore > 60 ? 0.9 : 0.78,
  });

  if (snapshot.intentScore < 35 || conversation.status === "follow_up") {
    suggestions.push({
      id: "follow-up",
      label: "Retomar com contexto",
      angle: "objection",
      text: buildFashionConsultativeReply(snapshot, "follow_up", tone),
      recommendedFor: "Reativação",
      confidence: 0.82,
    });
  }

  return orderAndTrimReplies(suggestions);
}

function getReplyTone(intentScore: number): FashionReplyTone {
  if (intentScore >= 80) return "direct";
  if (intentScore >= 50) return "consultive";
  return "exploratory";
}

function hasAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function orderAndTrimReplies(replies: SmartReplySuggestion[]) {
  return replies
    .sort((left, right) => {
      const leftIndex = ANGLE_PRIORITY.indexOf(left.angle as FashionReplyAngle);
      const rightIndex = ANGLE_PRIORITY.indexOf(right.angle as FashionReplyAngle);
      return leftIndex - rightIndex;
    })
    .slice(0, 4);
}
