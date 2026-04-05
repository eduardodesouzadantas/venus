import { LookData } from "@/types/result";

type HandoffLook = Pick<LookData, "id" | "name" | "intention" | "type" | "explanation" | "whenToWear">;

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

const inferOutcome = (input: WhatsAppHandoffInput) => {
  const cue = `${input.styleIdentity || ""} ${input.dominantStyle || ""} ${input.imageGoal || ""} ${input.paletteFamily || ""}`.toLowerCase();

  if (cue.includes("autoridade") || cue.includes("lider") || cue.includes("execut") || cue.includes("imponente")) {
    return "uma imagem mais firme, segura e credivel";
  }

  if (cue.includes("eleg") || cue.includes("premium") || cue.includes("refin") || cue.includes("luxo")) {
    return "uma leitura mais refinada e premium sem parecer pesada";
  }

  if (cue.includes("leve") || cue.includes("casual") || cue.includes("fresh") || cue.includes("minimal")) {
    return "uma presenca leve, limpa e facil de usar no dia a dia";
  }

  if (cue.includes("impact") || cue.includes("sensual") || cue.includes("noite") || cue.includes("festa")) {
    return "mais impacto visual e presença imediata";
  }

  return "uma proposta mais coerente, comercial e fácil de aceitar";
};

const trimSentence = (value: string) => value.replace(/\s+/g, " ").replace(/[.?!\s]+$/, "").trim();

export function buildWhatsAppHandoffMessage(input: WhatsAppHandoffInput) {
  const leadName = input.contactName ? `${input.contactName}, ` : "";
  const style = input.styleIdentity || input.dominantStyle || "sua assinatura de estilo";
  const goal = input.imageGoal || "seguir evoluindo a sua imagem";
  const outcome = inferOutcome(input);
  const topLook = input.lookSummary?.[0];
  const secondLook = input.lookSummary?.[1];
  const code = input.resultId ? `\nCodigo da curadoria: VENUS-${input.resultId.slice(0, 6).toUpperCase()}` : "";

  const lines = [
    `${leadName}quero continuar minha curadoria no WhatsApp.`,
    `Meu eixo principal hoje e ${style}, com foco em ${goal}.`,
    `O efeito que eu busco e ${outcome}.`,
    topLook
      ? `O look que mais me chamou foi ${topLook.name}${topLook.explanation ? `, porque ${trimSentence(topLook.explanation)}` : ""}.`
      : `Quero receber a proxima proposta mais coerente com o meu perfil.`,
    secondLook ? `Se fizer sentido, me mostre tambem uma alternativa no mesmo nivel de leitura visual.` : null,
    input.paletteFamily ? `Paleta de referencia: ${input.paletteFamily}.` : null,
    input.fit ? `Caimento preferido: ${input.fit}.` : null,
    input.metal ? `Metal de apoio: ${input.metal}.` : null,
    `Pode me orientar com a proxima etapa?`,
    code,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export function buildWhatsAppHandoffUrl(message: string) {
  const phone = normalizePhone(process.env.NEXT_PUBLIC_WHATSAPP_HANDOFF_PHONE);
  const encodedMessage = encodeURIComponent(message);

  if (phone) {
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }

  return `https://api.whatsapp.com/send?text=${encodedMessage}`;
}

export function buildWhatsAppHandoffPayload(input: WhatsAppHandoffInput) {
  return {
    ...input,
    createdAt: new Date().toISOString(),
    message: buildWhatsAppHandoffMessage(input),
  };
}
