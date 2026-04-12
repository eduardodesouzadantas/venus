export const VENUS_BRAND_NAME = "Venus";
export const VENUS_STYLIST_NAME = "Venus Stylist";
export const VENUS_SURFACE = "#0a0a0a";
export const VENUS_GOLD = "#C9A84C";

export type VenusResultState = "hero" | "preview" | "retry_required";

type VenusResultNarrativeInput = {
  state: VenusResultState;
  reason?: string;
  hasArtifact?: boolean;
  hasLegacy?: boolean;
};

export function buildVenusStylistIntro() {
  return "Oi. Eu sou a Venus Stylist. Vou ler sua presença como consultora, cruzar sua foto com colorimetria e fechar sua leitura com elegância.";
}

export function buildVenusBodyScannerIntro() {
  return "Agora a Venus fecha a leitura do corpo";
}

export function buildVenusResultNarrative(input: VenusResultNarrativeInput) {
  if (input.state === "hero") {
    return {
      eyebrow: "Revelação final",
      title: "Sua essência virou imagem.",
      subtitle:
        "A curadoria fechou com produto real, foto consistente e leitura premium. O resultado já está pronto para virar conversa.",
      primaryCta: "Quero esse look no WhatsApp",
      secondaryCta: "Continuar a conversa",
      helper:
        input.reason ||
        "A estrutura do look e a apresentação visual fecharam em padrão hero com consistência alta.",
    };
  }

  if (input.state === "preview") {
    return {
      eyebrow: "Prévia curada",
      title: "A leitura está muito perto do premium.",
      subtitle:
        "A imagem existe, está elegante e já comunica direção. Falta só um ajuste fino antes de subir como vitrine final.",
      primaryCta: "Refazer foto",
      secondaryCta: "Ver no WhatsApp",
      helper:
        input.reason ||
        "A leitura estrutural é boa, mas a apresentação ainda não sobe para hero.",
    };
  }

  return {
    eyebrow: input.hasLegacy ? "Leitura antiga" : "Nova tentativa",
    title: "Essa leitura pede uma nova foto.",
    subtitle: input.hasLegacy
      ? "O resultado veio de um legado sem produto validado para try-on. Vamos refazer com uma foto melhor para liberar a versão premium."
      : "A imagem ainda não atingiu integridade suficiente para virar hero. Com uma nova foto, a revelação fica mais precisa.",
    primaryCta: "Tirar nova foto",
    secondaryCta: input.hasArtifact ? "Voltar ao início" : "Refazer leitura",
    helper:
      input.reason ||
      "O resultado não atingiu integridade suficiente para exibição premium.",
  };
}

export function buildVenusWhatsAppLeadIn(input: {
  contactName?: string | null;
  state?: VenusResultState;
  lookName?: string | null;
}) {
  const greet = input.contactName ? `Oi, ${input.contactName}!` : "Oi!";
  const base =
    input.state === "hero"
      ? "A Venus Stylist já fechou sua leitura e o resultado ficou impressionante."
      : input.state === "preview"
        ? "A Venus Stylist já chegou muito perto da leitura ideal."
        : "A Venus Stylist quer refinar sua leitura com você.";

  const lookLine = input.lookName ? `O look que mais faz sentido agora é ${input.lookName}.` : "O look mais coerente já está mapeado.";

  return `${greet}\n${base}\n${lookLine}`;
}
