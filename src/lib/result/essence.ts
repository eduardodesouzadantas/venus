import type { OnboardingData } from "@/types/onboarding";

export type EssenceKey = "authority" | "elegance" | "presence" | "creative" | "discretion";

export type EssenceProfile = {
  key: EssenceKey;
  label: string;
  summary: string;
  confidenceLabel: string;
  keySignals: string[];
  styleDirection: "Masculina" | "Feminina" | "Neutra";
  lookNames: [string, string, string];
  toAvoid: string[];
};

type EssenceConfig = {
  label: string;
  confidenceLabel: string;
  lookNames: [string, string, string];
  toAvoid: string[];
};

const ESSENCE_CONFIG: Record<EssenceKey, EssenceConfig> = {
  authority: {
    label: "Autoridade silenciosa",
    confidenceLabel: "Leitura alta",
    lookNames: ["Assinatura de comando", "Presença firme", "Contraste de comando"],
    toAvoid: [
      "Excesso de ornamento sem função.",
      "Camadas que tiram a leitura de comando.",
      "Brilho demais quando o perfil pede direção.",
    ],
  },
  elegance: {
    label: "Elegância precisa",
    confidenceLabel: "Leitura alta",
    lookNames: ["Elegância limpa", "Presença refinada", "Detalhe editorial"],
    toAvoid: [
      "Contraste sem acabamento.",
      "Peças que deixam a composição pesada.",
      "Ruído visual que enfraquece a sofisticação.",
    ],
  },
  presence: {
    label: "Presença magnética",
    confidenceLabel: "Leitura alta",
    lookNames: ["Base magnética", "Presença de impacto", "Contraste social"],
    toAvoid: [
      "Composição tímida demais para o momento.",
      "Peças que apagam o ponto de intenção.",
      "Excesso de neutralidade quando o perfil pede impacto.",
    ],
  },
  creative: {
    label: "Editorial autoral",
    confidenceLabel: "Leitura alta",
    lookNames: ["Base autoral", "Linha editorial", "Contraste expressivo"],
    toAvoid: [
      "Combinações óbvias demais para o perfil.",
      "Elementos sem narrativa visual.",
      "Contraste sem direção clara.",
    ],
  },
  discretion: {
    label: "Minimalismo sofisticado",
    confidenceLabel: "Leitura alta",
    lookNames: ["Base silenciosa", "Linha precisa", "Textura sutil"],
    toAvoid: [
      "Peças barulhentas sem propósito.",
      "Camadas que quebram a leitura limpa.",
      "Excesso de informação em um único look.",
    ],
  },
};

const ENVIRONMENT_LABELS: Record<string, string> = {
  "corporativo rígido": "rotina corporativa",
  "escritório casual": "ambiente de escritório casual",
  "home office": "rotina mais flexível",
  "mundo noturno": "contextos de noite e impacto",
  "lazer / outdoor": "momentos de lazer e movimento",
  "eventos sociais": "eventos sociais",
};

const PURCHASE_DNA_LABELS: Record<string, string> = {
  "poucas & boas": "compra mais curada",
  "variedade constante": "compra mais exploratória",
};

const PURCHASE_BEHAVIOR_LABELS: Record<string, string> = {
  "compras planejadas": "ritmo de compra planejado",
  "compro por impulso": "ritmo de compra mais impulsivo",
};

function normalizeStyleDirection(value: unknown): "Masculina" | "Feminina" | "Neutra" {
  const text = matchText(normalizeText(value));
  if (text.includes("femin")) return "Feminina";
  if (text.includes("mascul")) return "Masculina";
  return "Neutra";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function matchText(value: string): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeList(values: string[]): string[] {
  return values.map((value) => normalizeText(value)).filter(Boolean);
}

function scoreArchetype(
  key: EssenceKey,
  goal: string,
  mainPain: string,
  environments: string[],
  purchaseDna: string,
  purchaseBehavior: string,
  fit: string,
  faceLines: string,
  metal: string,
  styleDirection: "Masculina" | "Feminina" | "Neutra",
): number {
  const goalText = matchText(goal);
  const painText = matchText(mainPain);
  const envText = environments.map(matchText);
  const dnaText = matchText(purchaseDna);
  const behaviorText = matchText(purchaseBehavior);
  const fitText = matchText(fit);
  const faceText = matchText(faceLines);
  const metalText = matchText(metal);
  const directionText = matchText(styleDirection);

  let score = 0;

  if (key === "authority") {
    if (goalText.includes("autor")) score += 6;
    if (painText.includes("nada me representa") || painText.includes("falta de tempo")) score += 3;
    if (envText.some((value) => value.includes("corporativo") || value.includes("escritorio"))) score += 5;
    if (behaviorText.includes("planej")) score += 2;
    if (fitText.includes("slim") || fitText.includes("just")) score += 2;
    if (faceText.includes("marc")) score += 1;
    if (metalText.includes("prate")) score += 1;
  }

  if (key === "elegance") {
    if (goalText.includes("eleg")) score += 6;
    if (envText.some((value) => value.includes("social") || value.includes("corporativo") || value.includes("escritorio"))) score += 4;
    if (dnaText.includes("poucas")) score += 3;
    if (behaviorText.includes("planej")) score += 2;
    if (fitText.includes("slim") || fitText.includes("relax")) score += 1;
    if (metalText.includes("dour")) score += 1;
  }

  if (key === "presence") {
    if (goalText.includes("atra")) score += 6;
    if (painText.includes("compro por impulso") || painText.includes("nada me representa")) score += 2;
    if (envText.some((value) => value.includes("noite") || value.includes("social") || value.includes("lazer"))) score += 5;
    if (dnaText.includes("variedade")) score += 2;
    if (behaviorText.includes("impul")) score += 3;
    if (faceText.includes("marc")) score += 2;
    if (metalText.includes("dour")) score += 2;
  }

  if (key === "creative") {
    if (goalText.includes("criativ")) score += 6;
    if (envText.some((value) => value.includes("home") || value.includes("lazer") || value.includes("social"))) score += 3;
    if (dnaText.includes("variedade")) score += 4;
    if (behaviorText.includes("impul")) score += 2;
    if (fitText.includes("oversized") || fitText.includes("relax")) score += 2;
    if (faceText.includes("suave")) score += 1;
  }

  if (key === "discretion") {
    if (goalText.includes("discri")) score += 6;
    if (painText.includes("falta de tempo")) score += 3;
    if (envText.some((value) => value.includes("home") || value.includes("corporativo"))) score += 3;
    if (dnaText.includes("poucas")) score += 4;
    if (behaviorText.includes("planej")) score += 2;
    if (fitText.includes("slim") || fitText.includes("just")) score += 1;
    if (metalText.includes("prate")) score += 1;
  }

  if (directionText.includes("mascul")) {
    if (key === "authority" || key === "discretion") score += 1;
  }

  if (directionText.includes("femin")) {
    if (key === "elegance" || key === "presence") score += 1;
  }

  return score;
}

function chooseEssenceKey(
  goal: string,
  mainPain: string,
  environments: string[],
  purchaseDna: string,
  purchaseBehavior: string,
  fit: string,
  faceLines: string,
  metal: string,
  styleDirection: "Masculina" | "Feminina" | "Neutra",
): { key: EssenceKey; gap: number } {
  const keys: EssenceKey[] = [
    "authority",
    "elegance",
    "presence",
    "creative",
    "discretion",
  ];
  const scores: Array<[EssenceKey, number]> = keys.map((key) => [
    key,
    scoreArchetype(key, goal, mainPain, environments, purchaseDna, purchaseBehavior, fit, faceLines, metal, styleDirection),
  ]);

  scores.sort((a, b) => b[1] - a[1]);
  const winner = scores[0]?.[0] || "elegance";
  const gap = Math.max(0, (scores[0]?.[1] || 0) - (scores[1]?.[1] || 0));
  return { key: winner, gap };
}

function getConfidenceLabel(gap: number): string {
  if (gap >= 6) return "Leitura muito alta";
  if (gap >= 3) return "Leitura alta";
  if (gap >= 1) return "Leitura clara";
  return "Leitura em refinamento";
}

function buildSummary(
  key: EssenceKey,
  goal: string,
  mainPain: string,
  environments: string[],
  purchaseDna: string,
  purchaseBehavior: string,
  fit: string,
  faceLines: string,
  metal: string,
  styleDirection: "Masculina" | "Feminina" | "Neutra",
): string {
  const config = ESSENCE_CONFIG[key];
  const goalText = normalizeText(goal).toLowerCase() || "sua intenção";
  const painText = normalizeText(mainPain).toLowerCase() || "ruído visual";
  const env = normalizeList(environments)
    .map((value) => ENVIRONMENT_LABELS[matchText(value)] || value.toLowerCase())
    .slice(0, 2);
  const dna = PURCHASE_DNA_LABELS[matchText(purchaseDna)] || normalizeText(purchaseDna).toLowerCase();
  const behavior = PURCHASE_BEHAVIOR_LABELS[matchText(purchaseBehavior)] || normalizeText(purchaseBehavior).toLowerCase();
  const fitText = normalizeText(fit).toLowerCase() || "caimento natural";
  const faceText = normalizeText(faceLines).toLowerCase() || "traços próprios";
  const metalText = normalizeText(metal).toLowerCase() || "metais neutros";
  const directionText = normalizeStyleDirection(styleDirection);

  const envLine = env.length > 0 ? `Seu contexto puxa para ${env.join(" e ")}.` : "Seu contexto ainda está sendo refinado.";
  const behaviorLine = dna || behavior ? `O ritmo de compra tende a ser ${dna || behavior}.` : "";
  const directionLine =
    directionText === "Neutra"
      ? "A linha de styling ainda não foi fechada; a curadoria vai manter a leitura mais neutra até a direção ficar explícita."
      : `A linha escolhida foi ${directionText.toLowerCase()}, então a curadoria evita misturar peças fora dessa direção.`;

  switch (key) {
    case "authority":
      return `A leitura cruza ${goalText}, ${envLine.toLowerCase()} ${directionLine} Isso aponta para ${config.label.toLowerCase()} com estrutura, pouco ruído e decisão clara. O ponto sensível hoje é ${painText}; o encaixe ${fitText} e os traços ${faceText} pedem uma presença mais firme, sustentada por ${metalText}.`;
    case "elegance":
      return `A leitura cruza ${goalText}, ${envLine.toLowerCase()} ${directionLine} Isso aponta para ${config.label.toLowerCase()} com acabamento limpo e coerência visual. O ponto sensível hoje é ${painText}; o encaixe ${fitText} e o ritmo de compra ${behavior || dna || "mais pensado"} pedem sofisticação sem excesso, sustentada por ${metalText}.`;
    case "presence":
      return `A leitura cruza ${goalText}, ${envLine.toLowerCase()} ${directionLine} Isso aponta para ${config.label.toLowerCase()} com mais intenção, contraste e presença. O ponto sensível hoje é ${painText}; o encaixe ${fitText} e os traços ${faceText} pedem uma assinatura que chama atenção sem perder controle, com ${metalText} ajudando a fechar a imagem.`;
    case "creative":
      return `A leitura cruza ${goalText}, ${envLine.toLowerCase()} ${directionLine} Isso aponta para ${config.label.toLowerCase()} com narrativa visual mais livre e autoral. O ponto sensível hoje é ${painText}; o encaixe ${fitText} e a forma de comprar ${behavior || dna || "mais exploratória"} pedem contraste com direção, não improviso, e ${metalText} como ponto de acabamento.`;
    case "discretion":
      return `A leitura cruza ${goalText}, ${envLine.toLowerCase()} ${directionLine} Isso aponta para ${config.label.toLowerCase()} com base silenciosa e sofisticação calma. O ponto sensível hoje é ${painText}; o encaixe ${fitText} e o ritmo de compra ${behavior || dna || "mais curado"} pedem baixo ruído, traço limpo e ${metalText} funcionando como detalhe.`;
  }
}

function buildSignals(
  goal: string,
  environments: string[],
  purchaseDna: string,
  purchaseBehavior: string,
  fit: string,
  faceLines: string,
  metal: string,
  styleDirection: "Masculina" | "Feminina" | "Neutra",
): string[] {
  const signalSet = new Set<string>();
  const goalText = normalizeText(goal);
  if (goalText) signalSet.add(goalText);
  normalizeList(environments).slice(0, 2).forEach((value) => signalSet.add(ENVIRONMENT_LABELS[matchText(value)] || value));

  const dna = PURCHASE_DNA_LABELS[matchText(purchaseDna)] || normalizeText(purchaseDna);
  const behavior = PURCHASE_BEHAVIOR_LABELS[matchText(purchaseBehavior)] || normalizeText(purchaseBehavior);
  const fitText = normalizeText(fit);
  const faceText = normalizeText(faceLines);
  const metalText = normalizeText(metal);
  const directionText = normalizeStyleDirection(styleDirection);

  if (dna) signalSet.add(dna);
  if (behavior) signalSet.add(behavior);
  if (fitText) signalSet.add(`Caimento ${fitText}`);
  if (faceText) signalSet.add(`Traços ${faceText}`);
  if (metalText) signalSet.add(`Metal ${metalText}`);
  if (directionText) signalSet.add(`Linha ${directionText}`);

  return [...signalSet].filter(Boolean).slice(0, 4);
}

export function deriveEssenceProfile(data: OnboardingData): EssenceProfile {
  const goal = normalizeText(data.intent.imageGoal) || "Elegância";
  const mainPain = normalizeText(data.intent.mainPain) || "ruído visual";
  const styleDirection = normalizeStyleDirection(data.intent.styleDirection);
  const environments = data.lifestyle.environments;
  const purchaseDna = normalizeText(data.lifestyle.purchaseDna);
  const purchaseBehavior = normalizeText(data.lifestyle.purchaseBehavior);
  const fit = normalizeText(data.body.fit) || "Slim";
  const faceLines = normalizeText(data.body.faceLines) || "Marcantes";
  const metal = normalizeText(data.colors.metal) || "Prateado";

  const chosen = chooseEssenceKey(goal, mainPain, environments, purchaseDna, purchaseBehavior, fit, faceLines, metal, styleDirection);
  const key = chosen.key;
  const config = ESSENCE_CONFIG[key];
  const summary = buildSummary(key, goal, mainPain, environments, purchaseDna, purchaseBehavior, fit, faceLines, metal, styleDirection);
  const keySignals = buildSignals(goal, environments, purchaseDna, purchaseBehavior, fit, faceLines, metal, styleDirection);

  return {
    key,
    label: config.label,
    summary,
    confidenceLabel: getConfidenceLabel(chosen.gap),
    keySignals,
    styleDirection,
    lookNames: config.lookNames,
    toAvoid: config.toAvoid,
  };
}

