import type { SmartReplyAngle, SmartReplySuggestion, WhatsAppConversation } from "@/types/whatsapp";
import {
  buildFashionConsultationSnapshot,
  buildFashionConsultativeReply,
  buildFashionSummaryLine,
  type FashionReplyTone,
} from "@/lib/whatsapp/fashion-consultant";

type SalesStage = "close" | "warm" | "support" | "follow_up";
type SalesActionKind = "send" | "compose" | "bundle" | "product" | "follow_up";

export interface SalesCopilotAction {
  id: string;
  label: string;
  kind: SalesActionKind;
  message?: string;
  helper?: string;
}

export interface SalesCopilotPlan {
  badge: string;
  title: string;
  subtitle: string;
  reason: string;
  stage: SalesStage;
  stats: {
    intentScore: number;
    tryOnCount: number;
    viewedProductsCount: number;
    status: WhatsAppConversation["status"];
  };
  primaryAction: SalesCopilotAction;
  quickActions: SalesCopilotAction[];
}

const PRIORITY_ANGLE_ORDER: SmartReplyAngle[] = ["closing", "price", "fit", "objection", "desire"];

export function buildSalesCopilotPlan(
  conversation: WhatsAppConversation,
  smartReplies: SmartReplySuggestion[],
): SalesCopilotPlan {
  const snapshot = buildFashionConsultationSnapshot(conversation);
  const tone = resolveTone(snapshot.intentScore);
  const bestReply = pickBestReply(smartReplies, conversation.status);

  const stage = resolveStage(conversation, snapshot.intentScore, snapshot.tryOnCount, snapshot.viewedProductsCount);
  const badge = resolveBadge(stage, conversation.status, snapshot.intentScore);
  const reason = resolveReason(stage, snapshot);
  const title = resolveTitle(stage, conversation.status);
  const subtitle = resolveSubtitle(stage, snapshot);

  const primaryAction = bestReply
    ? {
        id: `smart-reply:${bestReply.id}`,
        label: "Enviar resposta pronta",
        kind: "send" as const,
        message: bestReply.text,
        helper: bestReply.label,
      }
    : {
        id: "manual-close",
        label: stage === "support" ? "Abrir conversa" : "Enviar fechamento",
        kind: "compose" as const,
        message: buildFallbackMessage(stage, snapshot, tone),
        helper: stage === "support" ? "Qualificar" : "Fechar",
      };

  const quickActions = buildQuickActions({
    stage,
    snapshot,
    conversation,
    tone,
  });

  return {
    badge,
    title,
    subtitle,
    reason,
    stage,
    stats: {
      intentScore: snapshot.intentScore,
      tryOnCount: snapshot.tryOnCount,
      viewedProductsCount: snapshot.viewedProductsCount,
      status: conversation.status,
    },
    primaryAction,
    quickActions,
  };
}

function resolveStage(
  conversation: WhatsAppConversation,
  intentScore: number,
  tryOnCount: number,
  viewedProductsCount: number,
): SalesStage {
  if (conversation.status === "follow_up") return "follow_up";
  if (conversation.status === "human_required" || conversation.status === "human_takeover") return "close";
  if (intentScore >= 80 || tryOnCount >= 3) return "close";
  if (intentScore >= 45 || viewedProductsCount > 0) return "warm";
  return "support";
}

function resolveBadge(stage: SalesStage, status: WhatsAppConversation["status"], intentScore: number) {
  if (stage === "close") return intentScore >= 85 ? "Lead quente" : "Hora de fechar";
  if (stage === "follow_up") return "Reativar agora";
  if (status === "human_required") return "Resposta humana";
  return "Aquecer a conversa";
}

function resolveTitle(stage: SalesStage, status: WhatsAppConversation["status"]) {
  if (stage === "close") return status === "human_required" ? "Responder para fechar" : "Próxima ação de fechamento";
  if (stage === "follow_up") return "Retomar sem perder o timing";
  if (stage === "warm") return "Conduzir a decisão";
  return "Abrir a conversa certa";
}

function resolveSubtitle(stage: SalesStage, snapshot: ReturnType<typeof buildFashionConsultationSnapshot>) {
  const summary = buildFashionSummaryLine(snapshot);

  if (stage === "close") {
    const lookHint = snapshot.topLookItemSummary ? ` ${snapshot.topLookItemSummary}.` : "";
    return `A leitura já aponta para ${snapshot.topLookName || "o look principal"}.${lookHint} ${summary}`;
  }

  if (stage === "follow_up") {
    return `Reative com contexto curto e traga de volta a leitura que já existia. ${summary}`;
  }

  if (stage === "warm") {
    return `Use perfil, look e condição juntos para transformar interesse em resposta. ${summary}`;
  }

  return `Ainda falta contexto para fechar. Faça uma pergunta curta e alinhe ${snapshot.styleIdentity} com ${snapshot.imageGoal}.`;
}

function resolveReason(
  stage: SalesStage,
  snapshot: ReturnType<typeof buildFashionConsultationSnapshot>,
) {
  const base = `Intenção ${Math.round(snapshot.intentScore)}%, ${snapshot.tryOnCount} try-ons e ${snapshot.viewedProductsCount} produtos vistos.`;
  const intelligence = snapshot.topLookItemSummary ? ` A peça líder está sendo lida como ${snapshot.topLookItemSummary}.` : "";

  if (stage === "close") {
    return `${base}${intelligence} O melhor movimento agora é uma mensagem curta de fechamento com leitura de consultoria, não um texto genérico.`;
  }

  if (stage === "follow_up") {
    return `${base}${intelligence} A conversa já esfriou um pouco; retome com contexto e um próximo passo claro.`;
  }

  if (stage === "warm") {
    return `${base}${intelligence} Já existe interesse suficiente para puxar a conversa para o look certo sem parecer empurrado.`;
  }

  return `${base}${intelligence} Ainda vale qualificar melhor para conectar a assinatura visual da pessoa ao que ela realmente quer.`;
}

function pickBestReply(
  smartReplies: SmartReplySuggestion[],
  status: WhatsAppConversation["status"],
): SmartReplySuggestion | null {
  if (!smartReplies.length) return null;

  const preferredAngles: SmartReplyAngle[] =
    status === "follow_up" ? ["closing", "desire", "objection"] : PRIORITY_ANGLE_ORDER;

  for (const angle of preferredAngles) {
    const match = smartReplies.find((reply) => reply.angle === angle);
    if (match) return match;
  }

  return smartReplies[0] ?? null;
}

function buildFallbackMessage(
  stage: SalesStage,
  snapshot: ReturnType<typeof buildFashionConsultationSnapshot>,
  tone: FashionReplyTone,
) {
  if (stage === "close") {
    return buildFashionConsultativeReply(snapshot, "closing", tone);
  }

  if (stage === "follow_up") {
    return buildFashionConsultativeReply(snapshot, "follow_up", tone);
  }

  if (stage === "warm") {
    return buildFashionConsultativeReply(snapshot, "desire", tone);
  }

  return buildFashionConsultativeReply(snapshot, "objection", tone);
}

function buildQuickActions(params: {
  stage: SalesStage;
  snapshot: ReturnType<typeof buildFashionConsultationSnapshot>;
  conversation: WhatsAppConversation;
  tone: FashionReplyTone;
}): SalesCopilotAction[] {
  const actions: SalesCopilotAction[] = [];

  if (params.stage === "close" || params.stage === "warm") {
    actions.push({
      id: "bundle-push",
      label: "Mandar look completo",
      kind: "bundle",
      helper: "Mostra o conjunto e acelera o fechamento",
    });
  }

  if (params.conversation.user.viewedProducts.length > 0) {
    actions.push({
      id: "product-link",
      label: "Enviar produto-chave",
      kind: "product",
      helper: "Coloca a peça mais forte na frente",
    });
  }

  if (params.stage === "follow_up") {
    actions.push({
      id: "follow-up",
      label: "Marcar follow-up",
      kind: "follow_up",
      helper: "Volta para a fila de reativação",
    });
  } else {
    actions.push({
      id: "compose-question",
      label: "Abrir com pergunta",
      kind: "compose",
      message: buildFashionConsultativeReply(params.snapshot, "objection", params.tone),
      helper: "Qualifica sem perder o ritmo",
    });
  }

  if (actions.length < 3) {
    actions.push({
      id: "follow-up-alt",
      label: "Puxar retorno",
      kind: "follow_up",
      helper: "Mantém o lead vivo",
    });
  }

  return actions.slice(0, 3);
}

function resolveTone(intentScore: number): FashionReplyTone {
  if (intentScore >= 80) return "direct";
  if (intentScore >= 50) return "consultive";
  return "exploratory";
}
