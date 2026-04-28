import "server-only";

import type { ConversationContext, MessageAnalysis, ClosingTrigger } from "./conversation-engine-types";

export interface PhotoAnalysisResult {
  colorSeason?: string;
  faceShape?: string;
  undertones?: string;
  styleIdentity?: string;
  bestColors?: string[];
  idealNecklines?: string[];
  bodyType?: string;
}

export interface ConversionMetrics {
  photoSentAt: string | null;
  photoSentMessageCount: number;
  analysisCompletedAt: string | null;
  firstWowDeliveredAt: string | null;
  firstWowMessageCount: number;
  timeToFirstWowMs: number | null;
  continuedAfterWow: boolean;
  enteredClosingAt: string | null;
}

const PHOTO_PATTERN = /foto|envio|imagem|tirei|enviei|aqui está|see|picture|image|jpg|jpeg|png|webp/i;

export function detectPhotoUpload(message: string, context: ConversationContext): boolean {
  if (context.hasPhotoUploaded) return true;
  return PHOTO_PATTERN.test(message.toLowerCase());
}

export function generateAnticipationMessage(): string {
  return "A câmera é opcional. Sua leitura segue com base na direção de estilo que você definiu.";
}

export function generateConsultoryAfterWow(
  analysis: PhotoAnalysisResult,
  context: ConversationContext
): string {
  const parts: string[] = [];

  if (analysis.colorSeason) {
    parts.push(`A leitura de cor aponta ${analysis.colorSeason.toLowerCase()}.`);
  }

  if (analysis.faceShape) {
    parts.push(`O visagismo indica harmonia ${analysis.faceShape.toLowerCase()} para a composição visual.`);
  }

  if (analysis.bestColors && analysis.bestColors.length > 0) {
    parts.push(`As cores que mais iluminam você agora são ${analysis.bestColors.slice(0, 3).join(", ")}.`);
  }

  if (analysis.styleIdentity) {
    parts.push(`Seu estilo natural puxa mais para ${analysis.styleIdentity.toLowerCase()}.`);
  }

  if (analysis.bodyType) {
    parts.push(`No caimento, a composição visual ganha harmonia com um desenho ${analysis.bodyType.toLowerCase()}.`);
  }

  if (parts.length === 0) {
    return "Agora que já vi sua foto, posso te mostrar por que essa direção funciona e quais outras opções seguem na mesma linha.";
  }

  return `${parts.join(" ")} Quer que eu te mostre outras opções nessa mesma linha?`;
}

export function buildFollowUpWithoutPhoto(): string {
  return "Pode ser uma foto simples mesmo — eu ajusto tudo pra você 😊";
}

export function buildFallbackWithoutTryOn(): string {
  const messages = [
    "Os looks estão prontos para você ver! Quer que eu mostre?",
    "Tenho várias opções para o seu perfil. Quer ver?",
    "Posso te mostrar looks agora. Let's go?",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function initializeConversionMetrics(): ConversionMetrics {
  return {
    photoSentAt: null,
    photoSentMessageCount: 0,
    analysisCompletedAt: null,
    firstWowDeliveredAt: null,
    firstWowMessageCount: 0,
    timeToFirstWowMs: null,
    continuedAfterWow: false,
    enteredClosingAt: null,
  };
}

export function recordPhotoSent(
  metrics: ConversionMetrics,
  context: ConversationContext
): ConversionMetrics {
  return {
    ...metrics,
    photoSentAt: new Date().toISOString(),
    photoSentMessageCount: context.messageCount,
  };
}

export function recordFirstWow(
  metrics: ConversionMetrics,
  context: ConversationContext
): ConversionMetrics {
  const firstWowDeliveredAt = new Date().toISOString();
  const photoSentAt = metrics.photoSentAt ? new Date(metrics.photoSentAt) : null;
  const timeToFirstWowMs = photoSentAt
    ? new Date(firstWowDeliveredAt).getTime() - photoSentAt.getTime()
    : null;

  return {
    ...metrics,
    firstWowDeliveredAt,
    firstWowMessageCount: context.messageCount,
    timeToFirstWowMs,
  };
}

export function shouldOfferConsultory(
  context: ConversationContext,
  analysis: MessageAnalysis
): boolean {
  if (!context.analysisCompleted) return false;
  if (context.analysisCompleted && analysis.sentiment === "positive") return true;
  if (context.firstWowDelivered && context.messageCount > 1) return true;
  return false;
}

export function shouldTransitionToClosing(
  context: ConversationContext,
  closingTriggers: ClosingTrigger[]
): boolean {
  const hasPurchaseIntent = closingTriggers.some(
    (t) => t.type === "purchase_intent" || t.type === "positive_feedback"
  );

  if (hasPurchaseIntent && context.firstWowDelivered) return true;
  if (context.tryOnCount >= 3) return true;

  return false;
}
