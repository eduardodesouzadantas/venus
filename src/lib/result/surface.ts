import type { OnboardingData } from "@/types/onboarding";
import type { LookData, ResultPayload } from "@/types/result";

type GoalKey = "Autoridade" | "Elegância" | "Atração" | "Criatividade" | "Discrição sofisticada";

type ResultSurface = {
  hero: ResultPayload["hero"];
  palette: ResultPayload["palette"];
  diagnostic: ResultPayload["diagnostic"];
  bodyVisagism: ResultPayload["bodyVisagism"];
  accessories: ResultPayload["accessories"];
  looks: LookData[];
  toAvoid: string[];
  headline: string;
  subheadline: string;
  lookHierarchy: Array<{
    label: string;
    title: string;
    description: string;
  }>;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  footerLabel: string;
};

const LOOK_IMAGES = [
  [
    "https://images.unsplash.com/photo-1594932224491-bb24dcafe277?q=80&w=600&auto=format",
    "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?q=80&w=600&auto=format",
  ],
  [
    "https://images.unsplash.com/photo-1614676466623-f1f9e0d1213d?q=80&w=600&auto=format",
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format",
  ],
  [
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=600&auto=format",
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format",
  ],
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeGoalKey(goal: string): GoalKey {
  const normalized = normalizeText(goal).toLowerCase();
  if (normalized.includes("autor")) return "Autoridade";
  if (normalized.includes("criativ")) return "Criatividade";
  if (normalized.includes("atra")) return "Atração";
  if (normalized.includes("discri")) return "Discrição sofisticada";
  return "Elegância";
}

function buildPalette(goalKey: GoalKey, metal: string): ResultPayload["palette"] {
  const metalLabel = normalizeText(metal) === "Dourado" ? "metais quentes" : "metais frios";

  switch (goalKey) {
    case "Autoridade":
      return {
        family: "Presença de Autoridade",
        description: `Contraste alto, tons profundos e ${metalLabel} para sustentar uma leitura firme sem ruído.`,
        contrast: "Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#0F172A", name: "Marinho intenso" },
          { hex: "#F8FAFC", name: "Branco óptico" },
          { hex: "#334155", name: "Grafite" },
        ],
      };
    case "Atração":
      return {
        family: "Contraste Editorial",
        description: `Mais impacto visual, mas ainda com leitura limpa e ${metalLabel} funcionando como ponto de acabamento.`,
        contrast: "Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Azul noturno" },
          { hex: "#F5F5F4", name: "Off white" },
          { hex: "#7C2D12", name: "Vinho profundo" },
        ],
      };
    case "Criatividade":
      return {
        family: "Editorial de Contraste",
        description: `Cores mais expressivas, mas ainda legíveis, com ${metalLabel} ajudando a manter a composição controlada.`,
        contrast: "Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Azul noturno" },
          { hex: "#F8FAFC", name: "Branco óptico" },
          { hex: "#7C2D12", name: "Vinho profundo" },
        ],
      };
    case "Discrição sofisticada":
      return {
        family: "Neutros Silenciosos",
        description: `Baixo ruído, leitura limpa e ${metalLabel} discretos para uma presença mais refinada.`,
        contrast: "Médio",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Grafite" },
          { hex: "#F8FAFC", name: "Off white" },
          { hex: "#475569", name: "Chumbo" },
        ],
      };
    default:
      return {
        family: "Neutros Refinados",
        description: `Leitura limpa, coerência visual e ${metalLabel} mantendo a imagem pessoal e fácil de usar.`,
        contrast: "Médio Alto",
        metal: normalizeText(metal) || "Prateado",
        colors: [
          { hex: "#111827", name: "Marinho" },
          { hex: "#F8FAFC", name: "Branco óptico" },
          { hex: "#374151", name: "Grafite" },
        ],
      };
  }
}

function buildBodyVisagism(fit: string, faceLines: string): ResultPayload["bodyVisagism"] {
  const fitLabel = normalizeText(fit) || "Slim";
  const faceLabel = normalizeText(faceLines) || "Marcantes";

  return {
    shoulders:
      fitLabel === "Oversized"
        ? "Se a peça vier ampla, vale equilibrar com base mais limpa para não perder linha."
        : "Estruture os ombros com peças que sustentem a presença sem pesar.",
    face:
      faceLabel === "Marcantes"
        ? "Decotes em V e linhas angulares ajudam a equilibrar traços mais marcados."
        : "Linhas suaves e aberturas leves mantêm a leitura facial mais limpa.",
    generalFit: `O caimento ${fitLabel.toLowerCase()} mantém conforto, direção visual e uso real.`,
  };
}

function buildDiagnostic(goal: string, mainPain: string, fit: string, faceLines: string): ResultPayload["diagnostic"] {
  const goalLabel = normalizeText(goal) || "elegância";
  const painLabel = normalizeText(mainPain) || "ruído visual";
  const fitLabel = normalizeText(fit) || "Slim";
  const faceLabel = normalizeText(faceLines) || "Marcantes";

  return {
    currentPerception: `Seu perfil pede menos ruído e mais estrutura. Hoje o ponto sensível é ${painLabel.toLowerCase()} e o caimento ${fitLabel.toLowerCase()}.`,
    desiredGoal: `Projetar ${goalLabel.toLowerCase()} de um jeito mais limpo, pessoal e consistente.`,
    gapSolution: `Usar o catálogo real como eixo e sustentar ${goalLabel.toLowerCase()} com peças coerentes para seu rosto ${faceLabel.toLowerCase()}.`,
  };
}

function buildAccessories(goalKey: GoalKey, metal: string): ResultPayload["accessories"] {
  const metalLabel = normalizeText(metal) === "Dourado" ? "metais quentes" : "metais frios";

  return {
    scale: goalKey === "Atração" ? "Marcante" : goalKey === "Criatividade" ? "Moderada" : "Minimalista",
    focalPoint: "Punhos e parte superior do tronco",
    advice: `Mantenha poucos pontos de atenção e deixe ${metalLabel} sustentarem a leitura sem competir com a peça principal.`,
  };
}

function buildHero(goalKey: GoalKey, goal: string, fit: string): ResultPayload["hero"] {
  const dominantStyle =
    goalKey === "Autoridade"
      ? "Autoridade limpa"
      : goalKey === "Atração"
        ? "Presença magnética"
        : goalKey === "Criatividade"
          ? "Contraste editorial"
          : goalKey === "Discrição sofisticada"
            ? "Minimalismo preciso"
            : "Elegância precisa";

  return {
    dominantStyle,
    subtitle: `Seu perfil pede ${normalizeText(goal).toLowerCase() || "elegância"} com leitura limpa, fit ${normalizeText(fit).toLowerCase() || "slim"} e uso real.`,
    coverImageUrl: "",
  };
}

function buildLookItems(
  prefix: string,
  goalLabel: string,
  type: LookData["type"],
  images: string[],
): LookData["items"] {
  if (type === "Híbrido Seguro") {
    return [
      {
        id: `${prefix}-1`,
        brand: "Acervo real",
        name: "Blazer estruturado",
        photoUrl: images[0],
        premiumTitle: "Blazer estruturado",
        impactLine: "Organiza a leitura sem pesar.",
        functionalBenefit: "Entrega estrutura e simplifica a combinação.",
        socialEffect: "Passa presença controlada.",
        contextOfUse: `Rotina, reunião leve e transição entre contextos ${goalLabel}.`,
      },
      {
        id: `${prefix}-2`,
        brand: "Acervo real",
        name: "Camisa limpa",
        photoUrl: images[1],
        premiumTitle: "Camisa limpa",
        impactLine: "Traz uma base clara para o look respirar.",
        functionalBenefit: "Mantém a composição fácil de usar.",
        socialEffect: "Deixa a leitura mais segura e coerente.",
        contextOfUse: "Camada fundamental sob a peça principal.",
      },
    ];
  }

  if (type === "Híbrido Premium") {
    return [
      {
        id: `${prefix}-1`,
        brand: "Acervo real",
        name: "Camada refinada",
        photoUrl: images[0],
        premiumTitle: "Camada refinada",
        impactLine: "Sobe a presença sem exagero.",
        functionalBenefit: "Eleva a leitura com controle.",
        socialEffect: "Passa sofisticação mais evidente.",
        contextOfUse: `Reuniões decisivas e situações em que ${goalLabel} precisa aparecer.`,
      },
      {
        id: `${prefix}-2`,
        brand: "Acervo real",
        name: "Calça de base",
        photoUrl: images[1],
        premiumTitle: "Calça de base",
        impactLine: "Mantém o look firme e equilibrado.",
        functionalBenefit: "Sustenta a composição sem roubar atenção.",
        socialEffect: "Ajuda a deixar a presença mais estável.",
        contextOfUse: "Par natural da camada superior.",
      },
    ];
  }

  return [
    {
      id: `${prefix}-1`,
      brand: "Acervo real",
      name: "Peça de destaque",
      photoUrl: images[0],
      premiumTitle: "Peça de destaque",
      impactLine: "Coloca um ponto de intenção no look.",
      functionalBenefit: "Amplia repertório sem perder coerência.",
      socialEffect: "Cria presença com controle.",
      contextOfUse: `Momentos em que ${goalLabel} precisa sair do óbvio.`,
    },
    {
      id: `${prefix}-2`,
      brand: "Acervo real",
      name: "Acessório de foco",
      photoUrl: images[1],
      premiumTitle: "Acessório de foco",
      impactLine: "Fecha a composição com um ponto visual claro.",
      functionalBenefit: "Completa o conjunto sem competir com a peça principal.",
      socialEffect: "Deixa o resultado mais intencional.",
      contextOfUse: "Acabamento visual e finalização do look.",
    },
  ];
}

function buildLooks(goal: string, fit: string): LookData[] {
  const goalLabel = normalizeText(goal).toLowerCase() || "elegância";
  const fitLabel = normalizeText(fit).toLowerCase() || "slim";

  return [
    {
      id: "surface-look-1",
      name: "Base segura",
      intention: `Entrada limpa com ${goalLabel} e baixo ruído.`,
      type: "Híbrido Seguro",
      items: buildLookItems("surface-look-1", `${goalLabel} com fit ${fitLabel}`, "Híbrido Seguro", LOOK_IMAGES[0]),
      accessories: ["Relógio minimalista"],
      explanation: `A base segura a leitura do perfil e mantém o look fácil de usar no mundo real.`,
      whenToWear: "Rotina, reunião leve e transição entre contextos.",
      popularityRank: 1,
      isDailyPick: true,
    },
    {
      id: "surface-look-2",
      name: "Presença clara",
      intention: `Mais presença sem perder coerência com ${goalLabel}.`,
      type: "Híbrido Premium",
      items: buildLookItems("surface-look-2", `${goalLabel} com fit ${fitLabel}`, "Híbrido Premium", LOOK_IMAGES[1]),
      accessories: ["Ponto metálico discreto"],
      explanation: `A combinação sobe a presença sem sair do uso real nem parecer forçada.`,
      whenToWear: "Reuniões decisivas e apresentações importantes.",
      popularityRank: 2,
    },
    {
      id: "surface-look-3",
      name: "Contraste direcionado",
      intention: `Um ponto de destaque com controle para ampliar o repertório.`,
      type: "Expansão Direcionada",
      items: buildLookItems("surface-look-3", `${goalLabel} com fit ${fitLabel}`, "Expansão Direcionada", LOOK_IMAGES[2]),
      accessories: ["Óculos estruturado"],
      explanation: `Um toque de contraste amplia a leitura sem transformar a proposta em algo artificial.`,
      whenToWear: "Eventos sociais e momentos de maior intenção.",
      popularityRank: 3,
    },
  ];
}

export function buildResultSurface(data: OnboardingData): ResultSurface {
  const goal = normalizeText(data.intent.imageGoal) || "Elegância";
  const goalKey = normalizeGoalKey(goal);
  const fit = normalizeText(data.body.fit) || "Slim";
  const faceLines = normalizeText(data.body.faceLines) || "Marcantes";
  const metal = normalizeText(data.colors.metal) || "Prateado";
  const mainPain = normalizeText(data.intent.mainPain) || "ruído visual";

  const hero = buildHero(goalKey, goal, fit);
  const palette = buildPalette(goalKey, metal);
  const diagnostic = buildDiagnostic(goal, mainPain, fit, faceLines);
  const bodyVisagism = buildBodyVisagism(fit, faceLines);
  const accessories = buildAccessories(goalKey, metal);
  const looks = buildLooks(goal, fit);

  return {
    hero,
    palette,
    diagnostic,
    bodyVisagism,
    accessories,
    looks,
    toAvoid: [
      "Excesso de camadas sem função.",
      "Combinações que disputam atenção ao mesmo tempo.",
      "Peças sem relação com o catálogo real.",
    ],
    headline: `Seu perfil agora: ${hero.dominantStyle}`,
    subheadline: hero.subtitle,
    lookHierarchy: [
      {
        label: "Base",
        title: "Look 1",
        description: "Segura a leitura e deixa o perfil fácil de usar.",
      },
      {
        label: "Apoio",
        title: "Look 2",
        description: "Sobe a presença sem perder coerência.",
      },
      {
        label: "Destaque",
        title: "Look 3",
        description: "Abre contraste com controle para ampliar repertório.",
      },
    ],
    primaryCtaLabel: "Continuar no WhatsApp",
    secondaryCtaLabel: "Ver meus looks",
    footerLabel: "Curadoria sincronizada com o catálogo real",
  };
}
