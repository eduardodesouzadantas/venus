export const VENUS_BRAND_NAME = "Venus";
export const VENUS_STYLIST_NAME = "Venus Stylist";
export const VENUS_SURFACE = "#0a0a0a";
export const VENUS_GOLD = "#C9A84C";

export type VenusResultState = "hero" | "preview" | "retry_required";

export type VenusTenantBrandInput = {
  orgSlug?: string | null;
  orgName?: string | null;
  branchName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

export type VenusTenantBrand = {
  displayName: string;
  slug: string | null;
  logoUrl: string | null;
  primaryColor: string;
  hasLogo: boolean;
};

type VenusResultNarrativeInput = {
  state: VenusResultState;
  reason?: string;
  hasArtifact?: boolean;
  hasLegacy?: boolean;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function prettifySlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(/\s+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveVenusTenantBrand(input?: VenusTenantBrandInput | null, fallbackLabel = "sua loja"): VenusTenantBrand {
  const branchName = normalizeText(input?.branchName);
  const orgName = normalizeText(input?.orgName);
  const slug = normalizeText(input?.orgSlug);
  const logoUrl = normalizeText(input?.logoUrl) || null;

  return {
    displayName: branchName || orgName || (slug ? prettifySlug(slug) : fallbackLabel),
    slug: slug || null,
    logoUrl,
    primaryColor: normalizeText(input?.primaryColor) || VENUS_GOLD,
    hasLogo: Boolean(logoUrl),
  };
}

export function buildVenusStylistIntro() {
  return "Perfeito. Me envie uma foto e eu começo sua leitura premium agora.";
}

export function buildVenusBodyScannerIntro() {
  return "Perfeito. Agora eu refino sua leitura premium ✨";
}

export function buildVenusResultNarrative(input: VenusResultNarrativeInput) {
  if (input.state === "hero") {
    return {
      eyebrow: "Revelação final",
      title: "Sua essência virou imagem.",
      subtitle:
        "A curadoria fechou com produto real, foto consistente e leitura premium. O resultado já está pronto para seguir para o WhatsApp.",
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
      title: "A leitura está muito perto do ponto ideal.",
      subtitle:
        "A imagem existe, está elegante e já comunica direção. Falta só um ajuste fino antes de virar vitrine final.",
      primaryCta: "Refazer foto",
      secondaryCta: "Continuar no WhatsApp",
      helper:
        input.reason ||
        "A leitura estrutural é boa, mas a apresentação ainda não sobe para hero.",
    };
  }

  return {
    eyebrow: input.hasLegacy ? "Leitura antiga" : "Nova tentativa",
    title: "Essa leitura pede uma nova foto.",
    subtitle: input.hasLegacy
      ? "O resultado veio de uma leitura antiga, sem peça validada para try-on. Vamos refazer com uma foto melhor para liberar a versão premium."
      : "A imagem ainda não atingiu integridade suficiente para virar hero. Com uma nova foto, a revelação fica mais precisa.",
    primaryCta: "Tirar nova foto",
    secondaryCta: input.hasArtifact ? "Nova leitura" : "Refazer leitura",
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
      ? "A Venus Stylist já fechou sua leitura e o resultado ganhou presença."
      : input.state === "preview"
        ? "A Venus Stylist já chegou muito perto do ponto ideal."
        : "A Venus Stylist quer refinar a leitura com você.";

  const lookLine = input.lookName
    ? `O look que mais faz sentido agora é ${input.lookName}.`
    : "O look mais coerente já está mapeado.";

  return `${greet}\n${base}\n${lookLine}`;
}
