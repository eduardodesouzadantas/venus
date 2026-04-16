export type OnboardingIntroCopy = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  supportLine: string;
};

export type OnboardingWowCopy = {
  intro: string;
  followUp: string;
  sending: string;
  analyzing: string;
  wowTitle: string;
  wowSummary: string;
  consultiveNote: string;
  sendPhotoLabel: string;
  continueLabel: string;
  catalogLabel: string;
  whatsappLabel: string;
  nextSuggestionLabel: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildTargetLabel(orgLabel?: string | null) {
  const target = normalizeText(orgLabel);
  return target ? ` da ${target}` : "";
}

export function buildOnboardingIntroCopy(orgLabel?: string | null): OnboardingIntroCopy {
  const targetLabel = normalizeText(orgLabel) || "sua loja";

  return {
    eyebrow: "Consultoria premium",
    headline: `A experiência de ${targetLabel} começa com imagem, não com formulário.`,
    subheadline:
      "Toque em começar para abrir a consultoria photo-first da Venus com branding da loja e um fluxo limpo.",
    primaryCta: "Começar",
    supportLine: "Sem login. Sem ruído. Só a leitura que importa.",
  };
}

export function buildOnboardingWowCopy(orgLabel?: string | null): OnboardingWowCopy {
  const targetLabel = buildTargetLabel(orgLabel);

  return {
    intro: `Perfeito. Me envie uma foto sua e eu começo a leitura${targetLabel}.`,
    followUp: "Pode ser uma foto simples mesmo — eu ajusto tudo pra você 😊",
    sending: "Perfeito... já estou analisando aqui ✨",
    analyzing: "Agora eu cruzo rosto, cor e presença para te devolver o primeiro wow.",
    wowTitle: "Seu primeiro wow está pronto.",
    wowSummary: "Depois do resultado, eu te explico por que essa direção funciona e o que vale testar a seguir.",
    consultiveNote:
      "Depois do primeiro wow, a Venus entra na leitura consultiva: cor, visagismo e caimento conectados ao que você acabou de ver.",
    sendPhotoLabel: "Enviar foto agora",
    continueLabel: "Continuar com a Venus",
    catalogLabel: "Ir para catálogo assistido",
    whatsappLabel: "Ir para WhatsApp",
    nextSuggestionLabel: "Ver próxima sugestão",
  };
}
