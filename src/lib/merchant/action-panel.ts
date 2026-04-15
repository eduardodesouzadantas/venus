import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAgencyRole, normalizeTenantSlug } from "@/lib/tenant/core";
import type { LeadStatus } from "@/lib/leads";

export type MerchantActionPriority = "high" | "medium" | "low";
export type MerchantActionKind = "open_conversation" | "mark_lead" | "send_follow_up" | "view_result";
export type MerchantActionPanelState = "ok" | "partial" | "empty" | "error";

export interface MerchantActionPanelLeadRow {
  id: string;
  org_id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  saved_result_id: string | null;
  intent_score: number | null;
  whatsapp_key: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  owner_user_id: string | null;
  conversation_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_interaction_at: string | null;
}

export interface MerchantActionPanelConversationRow {
  id: string;
  org_slug: string;
  user_phone: string | null;
  user_name: string | null;
  status: string | null;
  priority: string | null;
  last_message: string | null;
  last_updated: string | null;
  unread_count: number | null;
  user_context: Record<string, unknown> | null;
}

export interface MerchantActionPanelTimelineRow {
  id: string;
  lead_id: string;
  org_id: string;
  actor_user_id: string | null;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

export interface MerchantActionPanelMessageRow {
  id: string;
  conversation_id: string;
  org_slug: string;
  sender: string;
  text: string;
  type: string;
  created_at: string;
}

export interface MerchantActionPanelTryOnRow {
  id: string;
  org_id: string;
  saved_result_id: string | null;
  product_id: string | null;
  status: string | null;
  result_image_url: string | null;
  created_at: string;
}

export interface MerchantActionPanelSavedResultRow {
  id: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface MerchantActionPanelContext {
  orgId: string;
  orgSlug: string;
  role: string;
  tenantActive: boolean;
  userOrgSlug: string;
}

export interface MerchantActionPanelSummary {
  hot: number;
  followUpsDue: number;
  openConversations: number;
  resultReady: number;
  recentTouches: number;
}

export interface MerchantActionHistoryItem {
  id: string;
  kind: "lead" | "whatsapp" | "tryon";
  title: string;
  detail: string;
  timestamp: string;
}

export interface MerchantActionCard {
  id: string;
  leadId: string;
  leadName: string;
  leadStatus: LeadStatus | string;
  priority: MerchantActionPriority;
  kind: MerchantActionKind;
  score: number;
  conversionScore: number;
  urgencyScore: number;
  title: string;
  summary: string;
  evidence: string[];
  recommendationReasons: string[];
  leadHref: string;
  conversationHref: string;
  resultHref: string | null;
  conversationId: string | null;
  phone: string | null;
  followUpText: string;
  followUpAt: string | null;
  suggestedStatus: LeadStatus | null;
  followUpActionLabel: string | null;
  resultLabel: string | null;
  messageTone: string;
  lastTouchedAt: string | null;
}

export interface MerchantActionPanelData {
  state: MerchantActionPanelState;
  summary: MerchantActionPanelSummary;
  cards: MerchantActionCard[];
  history: MerchantActionHistoryItem[];
  errors: string[];
}

type MerchantActionPanelBuildInput = {
  orgId: string;
  orgSlug: string;
  leads: MerchantActionPanelLeadRow[];
  conversations: MerchantActionPanelConversationRow[];
  leadTimeline: MerchantActionPanelTimelineRow[];
  whatsappMessages: MerchantActionPanelMessageRow[];
  tryons: MerchantActionPanelTryOnRow[];
  savedResults: MerchantActionPanelSavedResultRow[];
  now?: number;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/\D/g, "");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toTimeValue(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAgoLabel(timestamp: string | null, now: number) {
  const time = toTimeValue(timestamp);
  if (!time) return "sem recência";

  const minutesDelta = Math.round((now - time) / 60000);
  if (minutesDelta < 0) {
    const minutesAhead = Math.abs(minutesDelta);
    if (minutesAhead < 60) {
      return `em ${minutesAhead} min`;
    }

    const hoursAhead = Math.round(minutesAhead / 60);
    if (hoursAhead < 24) {
      return `em ${hoursAhead} h`;
    }

    const daysAhead = Math.round(hoursAhead / 24);
    return `em ${daysAhead} d`;
  }

  if (minutesDelta < 60) {
    return `${minutesDelta} min`;
  }

  const hours = Math.round(minutesDelta / 60);
  if (hours < 24) {
    return `${hours} h`;
  }

  const days = Math.round(hours / 24);
  return `${days} d`;
}

function formatLeadStatusLabel(status: string | null) {
  switch (status) {
    case "new":
      return "novo";
    case "engaged":
      return "em conversa";
    case "qualified":
      return "qualificado";
    case "offer_sent":
      return "oferta enviada";
    case "closing":
      return "fechamento";
    case "won":
      return "ganho";
    case "lost":
      return "perdido";
    default:
      return "sem status";
  }
}

function formatLeadStatus(status: string | null): LeadStatus | string {
  if (!status) return "new";
  return status as LeadStatus;
}

function nextLeadStatus(status: string | null): LeadStatus | null {
  switch (status) {
    case "new":
      return "engaged";
    case "engaged":
      return "qualified";
    case "qualified":
      return "offer_sent";
    case "offer_sent":
      return "closing";
    default:
      return null;
  }
}

function buildResultLabel(payload: Record<string, unknown> | null, fallbackLeadName: string) {
  if (!payload) return fallbackLeadName ? `Resultado de ${fallbackLeadName}` : "Resultado do cliente";

  const finalResult = asRecord(payload.finalResult);
  const handoff = asRecord(payload.whatsappHandoff);
  const lastTryOn = asRecord(payload.last_tryon);
  const lookSummary = Array.isArray(handoff.lookSummary)
    ? handoff.lookSummary[0] && typeof handoff.lookSummary[0] === "object" && !Array.isArray(handoff.lookSummary[0])
      ? (handoff.lookSummary[0] as Record<string, unknown>)
      : null
    : null;
  const firstLook = Array.isArray(finalResult.looks) && finalResult.looks[0] && typeof finalResult.looks[0] === "object" && !Array.isArray(finalResult.looks[0])
    ? (finalResult.looks[0] as Record<string, unknown>)
    : null;

  return (
    normalizeText(firstLook?.name) ||
    normalizeText(firstLook?.title) ||
    normalizeText(lookSummary?.name) ||
    normalizeText(lastTryOn?.product_name) ||
    normalizeText(handoff?.lookName) ||
    (fallbackLeadName ? `Resultado de ${fallbackLeadName}` : "Resultado do cliente")
  );
}

function buildFollowUpMessage(leadName: string, resultLabel: string | null, conversationLabel: string | null) {
  const intro = leadName ? `Oi, ${leadName}.` : "Oi.";
  const body = resultLabel
    ? `Separei o resultado de ${resultLabel.toLowerCase()} para te mostrar a próxima peça ideal.`
    : "Separei uma continuidade objetiva para manter seu atendimento no timing certo.";
  const tail = conversationLabel
    ? `Posso retomar por aqui com a mesma leitura consultiva?`
    : "Posso te mandar a próxima sugestão agora?";

  return `${intro} ${body} ${tail}`;
}

function pickLeadConversation(lead: MerchantActionPanelLeadRow, conversationsByPhone: Map<string, MerchantActionPanelConversationRow>) {
  const leadPhone = normalizePhone(lead.phone || lead.whatsapp_key);
  const byConversationId = lead.conversation_id ? conversationsByPhone.get(`conversation:${lead.conversation_id}`) || null : null;
  if (byConversationId) {
    return byConversationId;
  }

  if (!leadPhone) {
    return null;
  }

  return conversationsByPhone.get(leadPhone) || null;
}

function getLeadLastTouch(lead: MerchantActionPanelLeadRow, conversation: MerchantActionPanelConversationRow | null, tryon: MerchantActionPanelTryOnRow | null) {
  const candidates = [
    lead.last_interaction_at,
    lead.updated_at,
    conversation?.last_updated || null,
    tryon?.created_at || null,
    lead.created_at,
  ];

  for (const candidate of candidates) {
    const value = toTimeValue(candidate);
    if (value) return candidate || null;
  }

  return null;
}

function buildLeadEvidence(
  lead: MerchantActionPanelLeadRow,
  conversation: MerchantActionPanelConversationRow | null,
  tryon: MerchantActionPanelTryOnRow | null,
  savedResult: MerchantActionPanelSavedResultRow | null,
  now: number
) {
  const evidence = [
    `status ${formatLeadStatusLabel(lead.status)}`,
    `intenção ${typeof lead.intent_score === "number" ? lead.intent_score.toFixed(0) : "sem dados"}`,
  ];

  if (conversation) {
    evidence.push(`whatsapp ${formatAgoLabel(conversation.last_updated, now)}`);
    if ((conversation.unread_count || 0) > 0) {
      evidence.push(`${conversation.unread_count} msg não lida${conversation.unread_count === 1 ? "" : "s"}`);
    }
  }

  if (lead.next_follow_up_at) {
    evidence.push(`follow-up ${formatAgoLabel(lead.next_follow_up_at, now)}`);
  }

  if (tryon) {
    evidence.push(`try-on ${formatAgoLabel(tryon.created_at, now)}`);
  }

  if (savedResult) {
    evidence.push("resultado salvo");
  }

  return evidence.slice(0, 4);
}

function scoreMerchantAction(
  lead: MerchantActionPanelLeadRow,
  conversation: MerchantActionPanelConversationRow | null,
  tryon: MerchantActionPanelTryOnRow | null,
  savedResult: MerchantActionPanelSavedResultRow | null,
  now: number
) {
  const recommendationReasons: string[] = [];
  let conversionScore = 0;
  let urgencyScore = 0;

  const intent = typeof lead.intent_score === "number" && Number.isFinite(lead.intent_score) ? lead.intent_score : 0;
  conversionScore += Math.round(intent * 0.35);
  if (intent >= 80) {
    recommendationReasons.push(`Intenção alta (${Math.round(intent)}/100)`);
  } else if (intent >= 50) {
    recommendationReasons.push(`Intenção em progresso (${Math.round(intent)}/100)`);
  }

  if (conversation) {
    if ((conversation.unread_count || 0) > 0) {
      const unreadCount = conversation.unread_count || 0;
      conversionScore += 18;
      urgencyScore += 14;
      recommendationReasons.push(`${unreadCount} mensagem(ns) sem resposta`);
    }

    if (conversation.status === "human_required") {
      conversionScore += 28;
      urgencyScore += 18;
      recommendationReasons.push("Atendimento humano pedido");
    } else if (conversation.status === "human_takeover") {
      conversionScore += 20;
      urgencyScore += 12;
      recommendationReasons.push("Conversa sob controle humano");
    } else if (conversation.status === "follow_up") {
      conversionScore += 16;
      urgencyScore += 16;
      recommendationReasons.push("Conversa já em follow-up");
    } else if (conversation.status === "ai_active") {
      conversionScore += 10;
      recommendationReasons.push("WhatsApp ainda ativo");
    }
  }

  if (tryon) {
    const tryonAgeMinutes = Math.max(0, Math.round((now - (toTimeValue(tryon.created_at) || now)) / 60000));
    if (tryonAgeMinutes <= 60) {
      conversionScore += 18;
      urgencyScore += 10;
      recommendationReasons.push("Try-on recente");
    } else if (tryonAgeMinutes <= 24 * 60) {
      conversionScore += 12;
      urgencyScore += 8;
      recommendationReasons.push("Try-on nas últimas 24h");
    } else if (tryonAgeMinutes <= 7 * 24 * 60) {
      conversionScore += 6;
      urgencyScore += 4;
      recommendationReasons.push("Try-on ainda quente");
    }
  }

  const followUpAt = toTimeValue(lead.next_follow_up_at);
  if (followUpAt) {
    const minutesUntil = Math.round((followUpAt - now) / 60000);
    if (minutesUntil < 0) {
      urgencyScore += 28;
      recommendationReasons.push("Follow-up vencido");
    } else if (minutesUntil <= 24 * 60) {
      urgencyScore += 16;
      recommendationReasons.push("Follow-up nas próximas 24h");
    }
  } else if (lead.status === "engaged" || lead.status === "qualified" || lead.status === "offer_sent" || lead.status === "closing") {
    urgencyScore += 8;
    recommendationReasons.push("Lead ativo sem próxima ação");
  }

  if (savedResult) {
    conversionScore += 8;
    recommendationReasons.push("Resultado já salvo");
  }

  const lastTouch = getLeadLastTouch(lead, conversation, tryon);
  const ageMinutes = lastTouch ? Math.max(0, Math.round((now - (toTimeValue(lastTouch) || now)) / 60000)) : Number.POSITIVE_INFINITY;
  if (ageMinutes <= 60) {
    conversionScore += 12;
    urgencyScore += 6;
    recommendationReasons.push("Toque recente");
  } else if (ageMinutes <= 24 * 60) {
    conversionScore += 8;
    urgencyScore += 4;
    recommendationReasons.push("Atividade nas últimas 24h");
  } else if (ageMinutes <= 3 * 24 * 60) {
    conversionScore += 4;
    urgencyScore += 2;
    recommendationReasons.push("Atividade nos últimos 3 dias");
  }

  const score = Math.max(0, Math.min(100, Math.round(conversionScore + urgencyScore)));

  return {
    score,
    conversionScore: Math.max(0, Math.min(100, Math.round(conversionScore))),
    urgencyScore: Math.max(0, Math.min(100, Math.round(urgencyScore))),
    recommendationReasons: recommendationReasons.slice(0, 4),
  };
}

function buildCardKind(
  lead: MerchantActionPanelLeadRow,
  conversation: MerchantActionPanelConversationRow | null,
  tryon: MerchantActionPanelTryOnRow | null,
  savedResult: MerchantActionPanelSavedResultRow | null,
  now: number
): MerchantActionKind {
  const followUpAt = toTimeValue(lead.next_follow_up_at);
  const overdueFollowUp = followUpAt !== null && followUpAt < now;
  const hasRecentConversation = conversation ? (conversation.status === "human_required" || conversation.status === "human_takeover" || (conversation.unread_count || 0) > 0) : false;
  const hasRecentTryOn = tryon ? now - (toTimeValue(tryon.created_at) || now) <= 7 * 24 * 60 * 60000 : false;

  if (hasRecentConversation) {
    return "open_conversation";
  }

  if (overdueFollowUp || (conversation && conversation.status === "follow_up")) {
    return "send_follow_up";
  }

  if (savedResult && hasRecentTryOn) {
    return "view_result";
  }

  return "mark_lead";
}

function buildPrimaryTitle(kind: MerchantActionKind, leadName: string) {
  switch (kind) {
    case "open_conversation":
      return `Abrir conversa com ${leadName}`;
    case "send_follow_up":
      return `Enviar follow-up para ${leadName}`;
    case "view_result":
      return `Ver resultado de ${leadName}`;
    case "mark_lead":
    default:
      return `Marcar lead de ${leadName}`;
  }
}

function buildActionSummary(
  kind: MerchantActionKind,
  lead: MerchantActionPanelLeadRow,
  conversation: MerchantActionPanelConversationRow | null,
  tryon: MerchantActionPanelTryOnRow | null,
  savedResult: MerchantActionPanelSavedResultRow | null,
  now: number,
  resultLabel: string | null
) {
  if (kind === "open_conversation" && conversation) {
    const unreadPart = (conversation.unread_count || 0) > 0 ? ` com ${conversation.unread_count} mensagem(ns) pendente(s)` : "";
    return `Conversa ${conversation.status?.replaceAll("_", " ") || "ativa"}${unreadPart}.`;
  }

  if (kind === "send_follow_up") {
    if (lead.next_follow_up_at) {
      const nextFollowUp = toTimeValue(lead.next_follow_up_at);
      return `Follow-up ${nextFollowUp && nextFollowUp < now ? "em atraso" : "agendado"} para ${formatAgoLabel(lead.next_follow_up_at, now)}.`;
    }

    return "Lead sem follow-up claro. Vale retomar com uma mensagem curta e consultiva.";
  }

  if (kind === "view_result" && savedResult) {
    return resultLabel ? `Resultado salvo para ${resultLabel}.` : "Resultado do cliente disponível para revisão.";
  }

  if (tryon) {
    return `Try-on concluído há ${formatAgoLabel(tryon.created_at, now)}.`;
  }

  return `Lead em ${formatLeadStatusLabel(lead.status)}.`;
}

function buildHistory(
  leadTimeline: MerchantActionPanelTimelineRow[],
  whatsappMessages: MerchantActionPanelMessageRow[],
  tryons: MerchantActionPanelTryOnRow[],
  leadsById: Map<string, MerchantActionPanelLeadRow>,
  conversationsById: Map<string, MerchantActionPanelConversationRow>,
  now: number
) {
  const items: MerchantActionHistoryItem[] = [];

  for (const event of leadTimeline.slice(0, 20)) {
    const lead = leadsById.get(event.lead_id);
    const eventAt = event.created_at;

    if (event.event_type === "status_changed") {
      const current = normalizeText((event.event_data || {}).current);
      items.push({
        id: `lead-status:${event.id}`,
        kind: "lead",
        title: lead ? lead.name || "Lead" : "Lead atualizado",
        detail: `Status marcado como ${formatLeadStatusLabel(current || null)}`,
        timestamp: eventAt,
      });
      continue;
    }

    if (event.event_type === "follow_up_scheduled") {
      items.push({
        id: `lead-followup:${event.id}`,
        kind: "lead",
        title: lead ? lead.name || "Lead" : "Follow-up",
        detail: `Follow-up agendado para ${formatAgoLabel(normalizeText((event.event_data || {}).next_follow_up_at), now)}`,
        timestamp: eventAt,
      });
      continue;
    }

    if (event.event_type === "note_added") {
      items.push({
        id: `lead-note:${event.id}`,
        kind: "lead",
        title: lead ? lead.name || "Lead" : "Lead",
        detail: "Nota registrada na operação",
        timestamp: eventAt,
      });
      continue;
    }

    if (event.event_type === "assigned") {
      items.push({
        id: `lead-assigned:${event.id}`,
        kind: "lead",
        title: lead ? lead.name || "Lead" : "Lead",
        detail: "Lead atribuído a alguém do time",
        timestamp: eventAt,
      });
    }
  }

  for (const message of whatsappMessages.slice(0, 20)) {
    const conversation = conversationsById.get(message.conversation_id);
    if (!conversation) continue;

    items.push({
      id: `wa:${message.id}`,
      kind: "whatsapp",
      title: conversation.user_name || normalizePhone(conversation.user_phone) || "Conversa WhatsApp",
      detail: `${message.sender === "merchant" ? "Mensagem enviada" : "Resposta do cliente"}: ${message.text.slice(0, 70)}`,
      timestamp: message.created_at,
    });
  }

  for (const tryon of tryons.slice(0, 20)) {
    items.push({
      id: `tryon:${tryon.id}`,
      kind: "tryon",
      title: "Try-on concluído",
      detail: tryon.result_image_url ? "Imagem gerada e persistida" : "Try-on registrado",
      timestamp: tryon.created_at,
    });
  }

  return items
    .filter((item) => Boolean(item.timestamp))
    .sort((left, right) => (toTimeValue(right.timestamp) || 0) - (toTimeValue(left.timestamp) || 0))
    .slice(0, 10);
}

function buildPanelSummary(cards: MerchantActionCard[]): MerchantActionPanelSummary {
  return {
    hot: cards.filter((card) => card.priority === "high").length,
    followUpsDue: cards.filter((card) => card.kind === "send_follow_up").length,
    openConversations: cards.filter((card) => card.kind === "open_conversation").length,
    resultReady: cards.filter((card) => card.kind === "view_result").length,
    recentTouches: cards.filter((card) => Boolean(card.lastTouchedAt)).length,
  };
}

export function canAccessMerchantActionPanel(context: MerchantActionPanelContext) {
  if (!context.tenantActive) {
    return false;
  }

  if (isAgencyRole(context.role)) {
    return true;
  }

  return normalizeTenantSlug(context.userOrgSlug) === normalizeTenantSlug(context.orgSlug);
}

export function buildMerchantActionPanel(input: MerchantActionPanelBuildInput): MerchantActionPanelData {
  const now = input.now ?? Date.now();
  const leadsById = new Map(input.leads.map((lead) => [lead.id, lead]));
  const conversationsById = new Map(input.conversations.map((conversation) => [conversation.id, conversation]));
  const conversationsByPhone = new Map<string, MerchantActionPanelConversationRow>();

  for (const conversation of input.conversations) {
    const phone = normalizePhone(conversation.user_phone);
    if (phone && !conversationsByPhone.has(phone)) {
      conversationsByPhone.set(phone, conversation);
    }

    conversationsByPhone.set(`conversation:${conversation.id}`, conversation);
  }

  const savedResultsById = new Map(input.savedResults.map((row) => [row.id, row]));
  const tryonBySavedResult = new Map<string, MerchantActionPanelTryOnRow>();

  for (const tryon of input.tryons) {
    if (tryon.saved_result_id && !tryonBySavedResult.has(tryon.saved_result_id)) {
      tryonBySavedResult.set(tryon.saved_result_id, tryon);
    }
  }

  const candidateCards: Array<MerchantActionCard | null> = input.leads
    .map((lead) => {
      const conversation = pickLeadConversation(lead, conversationsByPhone);
      const savedResult = lead.saved_result_id ? savedResultsById.get(lead.saved_result_id) || null : null;
      const tryon = lead.saved_result_id ? tryonBySavedResult.get(lead.saved_result_id) || null : null;
      const scorecard = scoreMerchantAction(lead, conversation, tryon, savedResult, now);
      const score = scorecard.score;
      if (score < 18) {
        return null;
      }

      const kind = buildCardKind(lead, conversation, tryon, savedResult, now);
      const leadName = normalizeText(lead.name) || conversation?.user_name || "Cliente Venus";
      const resultLabel = savedResult ? buildResultLabel(savedResult.payload, leadName) : null;
      const lastTouchedAt = getLeadLastTouch(lead, conversation, tryon);
      const followUpText = buildFollowUpMessage(leadName, resultLabel, conversation?.last_message || null);
      const suggestedStatus = kind === "mark_lead" ? nextLeadStatus(lead.status) : nextLeadStatus(lead.status) || null;
      const evidence = buildLeadEvidence(lead, conversation, tryon, savedResult, now);

      return {
        id: `lead-${lead.id}`,
        leadId: lead.id,
        leadName,
        leadStatus: formatLeadStatus(lead.status),
        priority: score >= 72 ? "high" : score >= 45 ? "medium" : "low",
        kind,
        score,
        conversionScore: scorecard.conversionScore,
        urgencyScore: scorecard.urgencyScore,
        title: buildPrimaryTitle(kind, leadName),
        summary: buildActionSummary(kind, lead, conversation, tryon, savedResult, now, resultLabel),
        evidence,
        recommendationReasons: scorecard.recommendationReasons,
        leadHref: `/org/${input.orgSlug}/crm`,
        conversationHref: conversation ? `/org/${input.orgSlug}/whatsapp/inbox?conversationId=${conversation.id}` : `/org/${input.orgSlug}/whatsapp/inbox`,
        resultHref: lead.saved_result_id ? `/result?id=${lead.saved_result_id}` : null,
        conversationId: conversation?.id || null,
        phone: normalizePhone(lead.phone || lead.whatsapp_key) || conversation?.user_phone || null,
        followUpText,
        followUpAt: lead.next_follow_up_at,
        suggestedStatus: suggestedStatus && suggestedStatus !== lead.status ? suggestedStatus : null,
        followUpActionLabel: kind === "send_follow_up" ? "Enviar follow-up" : conversation ? "Retomar follow-up" : "Agendar follow-up",
        resultLabel,
        messageTone: kind === "send_follow_up" ? "follow-up" : kind === "open_conversation" ? "hot" : "operacional",
        lastTouchedAt,
      } satisfies MerchantActionCard;
    })
    ;

  const cards = candidateCards
    .filter((card): card is MerchantActionCard => card !== null)
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        const rank = { high: 3, medium: 2, low: 1 } as const;
        return rank[right.priority] - rank[left.priority];
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftTime = toTimeValue(left.lastTouchedAt);
      const rightTime = toTimeValue(right.lastTouchedAt);
      return (rightTime || 0) - (leftTime || 0);
    })
    .slice(0, 5);

  const history = buildHistory(input.leadTimeline, input.whatsappMessages, input.tryons, leadsById, conversationsById, now);
  const summary = buildPanelSummary(cards);
  const errors: string[] = [];

  return {
    state: cards.length === 0 ? "empty" : "ok",
    summary,
    cards,
    history,
    errors,
  };
}

export async function loadMerchantActionPanel(supabase: SupabaseClient, input: { orgId: string; orgSlug: string }) {
  const [leadsResult, conversationsResult, leadTimelineResult, whatsappMessagesResult, tryonsResult, savedResultsResult] =
    await Promise.all([
      supabase
        .from("leads")
        .select(
          "id, org_id, name, phone, status, saved_result_id, intent_score, whatsapp_key, next_follow_up_at, notes, owner_user_id, conversation_id, created_at, updated_at, last_interaction_at"
        )
        .eq("org_id", input.orgId)
        .order("updated_at", { ascending: false })
        .limit(150),
      supabase
        .from("whatsapp_conversations")
        .select("id, org_slug, user_phone, user_name, status, priority, last_message, last_updated, unread_count, user_context")
        .eq("org_slug", input.orgSlug)
        .order("last_updated", { ascending: false })
        .limit(150),
      supabase
        .from("lead_timeline")
        .select("id, lead_id, org_id, actor_user_id, event_type, event_data, created_at")
        .eq("org_id", input.orgId)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("whatsapp_messages")
        .select("id, conversation_id, org_slug, sender, text, type, created_at")
        .eq("org_slug", input.orgSlug)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("tryon_events")
        .select("id, org_id, saved_result_id, product_id, status, result_image_url, created_at")
        .eq("org_id", input.orgId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("saved_results")
        .select("id, payload, created_at")
        .eq("org_id", input.orgId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

  if (leadsResult.error) {
    return {
      state: "error" as const,
      summary: {
        hot: 0,
        followUpsDue: 0,
        openConversations: 0,
        resultReady: 0,
        recentTouches: 0,
      },
      cards: [],
      history: [],
      errors: [leadsResult.error.message],
    };
  }

  const data = buildMerchantActionPanel({
    orgId: input.orgId,
    orgSlug: input.orgSlug,
    leads: (leadsResult.data || []) as MerchantActionPanelLeadRow[],
    conversations: (conversationsResult.data || []) as MerchantActionPanelConversationRow[],
    leadTimeline: (leadTimelineResult.data || []) as MerchantActionPanelTimelineRow[],
    whatsappMessages: (whatsappMessagesResult.data || []) as MerchantActionPanelMessageRow[],
    tryons: (tryonsResult.data || []) as MerchantActionPanelTryOnRow[],
    savedResults: (savedResultsResult.data || []) as MerchantActionPanelSavedResultRow[],
  });

  const errors = [
    conversationsResult.error?.message,
    leadTimelineResult.error?.message,
    whatsappMessagesResult.error?.message,
    tryonsResult.error?.message,
    savedResultsResult.error?.message,
  ].filter((value): value is string => Boolean(value));

  if (errors.length > 0) {
    return {
      ...data,
      state: data.cards.length > 0 ? "partial" : "error",
      errors,
    };
  }

  return data;
}
