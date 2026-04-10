import { LookData } from "@/types/result";
import type { WhatsAppLookSummary } from "@/types/whatsapp";
import { describeLookIntelligence } from "@/lib/whatsapp/fashion-consultant";

type HandoffLook = WhatsAppLookSummary & {
  items?: Array<NonNullable<LookData["items"]>[number]>;
};

export interface WhatsAppHandoffInput {
  resultId?: string | null;
  contactName?: string;
  contactPhone?: string;
  styleIdentity?: string;
  dominantStyle?: string;
  imageGoal?: string;
  paletteFamily?: string;
  lookSummary?: HandoffLook[];
  intentScore?: number;
  fit?: string;
  metal?: string;
}

const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "");

export function getWhatsAppHandoffPhone() {
  return normalizePhone(process.env.NEXT_PUBLIC_WHATSAPP_HANDOFF_PHONE);
}

const inferOutcome = (input: WhatsAppHandoffInput) => {
  const cue = `${input.styleIdentity || ""} ${input.dominantStyle || ""} ${input.imageGoal || ""} ${input.paletteFamily || ""}`.toLowerCase();
  const intelligence = describeLookIntelligence(input.lookSummary?.[0]);

  if (cue.includes("autoridade") || cue.includes("lider") || cue.includes("execut") || cue.includes("imponente")) {
    return `uma imagem mais firme, segura e credível${intelligence ? `, com ${trimSentence(intelligence).toLowerCase()}` : ""}`;
  }

  if (cue.includes("eleg") || cue.includes("premium") || cue.includes("refin") || cue.includes("luxo")) {
    return `uma leitura mais refinada e premium sem parecer pesada${intelligence ? `, sustentada por ${trimSentence(intelligence).toLowerCase()}` : ""}`;
  }

  if (cue.includes("leve") || cue.includes("casual") || cue.includes("fresh") || cue.includes("minimal")) {
    return `uma presença leve, limpa e fácil de usar no dia a dia${intelligence ? `, com ${trimSentence(intelligence).toLowerCase()}` : ""}`;
  }

  if (cue.includes("impact") || cue.includes("sensual") || cue.includes("noite") || cue.includes("festa")) {
    return `mais impacto visual e presença imediata${intelligence ? `, com ${trimSentence(intelligence).toLowerCase()}` : ""}`;
  }

  return `uma proposta mais coerente, comercial e fácil de aceitar${intelligence ? `, guiada por ${trimSentence(intelligence).toLowerCase()}` : ""}`;
};

const trimSentence = (value: string) => value.replace(/\s+/g, " ").replace(/[.?!\s]+$/, "").trim();

export function buildWhatsAppHandoffMessage(input: WhatsAppHandoffInput) {
  const leadName = input.contactName ? `Oi, ${input.contactName}!` : "Oi!";
  const style = input.styleIdentity || input.dominantStyle || "sua assinatura de estilo";
  const goal = input.imageGoal || "seguir evoluindo a sua imagem";
  const outcome = inferOutcome(input);
  const topLook = input.lookSummary?.[0];
  const secondLook = input.lookSummary?.[1];
  const intelligence = describeLookIntelligence(topLook);

  const lines = [
    leadName,
    `Acabei de ver meus looks recomendados e quero continuar por aqui.`,
    `Meu perfil ficou mais alinhado com ${style}, com foco em ${goal}.`,
    `O efeito que eu busco é ${outcome}.`,
    topLook
      ? `O look que mais fez sentido foi ${topLook.name}${topLook.explanation ? `, porque ${trimSentence(topLook.explanation)}` : ""}${intelligence ? ` • ${trimSentence(intelligence)}` : ""}.`
      : `Quero entender a próxima opção mais coerente com o meu perfil.`,
    secondLook ? `Se fizer sentido, me mostra outra opção no mesmo clima.` : null,
    `Pode me orientar com a próxima etapa?`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export function buildWhatsAppHandoffUrl(message: string, phone = getWhatsAppHandoffPhone()) {
  const encodedMessage = encodeURIComponent(message);

  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }

  return null;
}

export function buildWhatsAppHandoffPayload(input: WhatsAppHandoffInput) {
  return {
    ...input,
    createdAt: new Date().toISOString(),
    message: buildWhatsAppHandoffMessage(input),
  };
}
