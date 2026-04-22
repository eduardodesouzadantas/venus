import type { OnboardingData } from "@/types/onboarding";
import {
  defaultConsultationProfile,
  normalizeConsultationProfile,
  type ConsultationBoldness,
  type ConsultationConfidenceSource,
  type ConsultationProfile,
} from "@/lib/consultation-profile";
import { STYLE_DIRECTION_CHOICES, normalizeStyleDirectionPreference, type StyleDirectionPreference } from "@/lib/style-direction";

export type ConsultationQuestionKey =
  | "styleDirection"
  | "desiredPerception"
  | "occasion"
  | "boldness"
  | "restrictions"
  | "preferredColors"
  | "bodyFocus"
  | "aestheticVibe";

export type ConsultationQuestionKind = "single" | "multi" | "text";

export type ConsultationQuestionOption = {
  label: string;
  value: string;
  conversationValue?: string;
};

export type ConsultationQuestionStep = {
  key: ConsultationQuestionKey;
  kind: ConsultationQuestionKind;
  title: string;
  prompt: string;
  placeholder: string;
  options?: ConsultationQuestionOption[];
  optional?: boolean;
  multiple?: boolean;
  note?: string;
};

export const CONSULTATION_STYLE_DIRECTION_OPTIONS = STYLE_DIRECTION_CHOICES;

export const CONSULTATION_DESIRED_PERCEPTION_OPTIONS = [
  "Autoridade clara",
  "Elegância refinada",
  "Presença confiante",
  "Discrição sofisticada",
  "Criatividade controlada",
] as const;

export const CONSULTATION_OCCASION_OPTIONS = [
  "Rotina",
  "Trabalho",
  "Evento",
  "Jantar",
  "Viagem",
  "Social",
] as const;

export const CONSULTATION_BOLDNESS_OPTIONS = [
  { label: "Discreta", value: "low", conversationValue: "discreta" },
  { label: "Equilibrada", value: "medium", conversationValue: "equilibrada" },
  { label: "Marcante", value: "high", conversationValue: "marcante" },
] as const;

export const CONSULTATION_RESTRICTION_OPTIONS = [
  "Nada justo",
  "Sem transparência",
  "Sem decote profundo",
  "Sem manga curta",
  "Sem brilho",
  "Sem estampas",
] as const;

export const CONSULTATION_COLOR_OPTIONS = [
  "Preto / branco / cinza",
  "Tons terrosos",
  "Azuis e verdes",
  "Vinhos e bordôs",
  "Pastéis",
] as const;

export const CONSULTATION_BODY_FOCUS_OPTIONS = [
  "Rosto",
  "Ombros e tronco",
  "Silhueta",
  "Pernas",
  "Caimento geral",
] as const;

export const CONSULTATION_VIBE_OPTIONS = [
  "Clean",
  "Clássica",
  "Editorial",
  "Urbana",
  "Social",
] as const;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => normalizeText(entry)).filter(Boolean) : [];
}

function hasContextualSignal(data: OnboardingData) {
  return Boolean(
    data.lifestyle.environments.length ||
      data.lifestyle.purchaseDna ||
      data.lifestyle.purchaseBehavior ||
      data.colors.favoriteColors.length ||
      data.colors.avoidColors.length ||
      data.body.highlight.length ||
      data.body.camouflage.length ||
      data.body.fit ||
      data.colorimetry.colorSeason ||
      data.colorimetry.contrast,
  );
}

function shouldAskOptionalQuestions(data: OnboardingData, consultation: ConsultationProfile) {
  const rawStyleDirection = normalizeText(data.consultation?.styleDirection || data.intent.styleDirection);
  const neutralDirection = consultation.styleDirection === "neutral" || consultation.styleDirection === "no_preference";
  const hasCoreConsultation = Boolean(
    rawStyleDirection &&
      consultation.desiredPerception &&
      consultation.occasion,
  );

  return hasCoreConsultation && (neutralDirection || hasContextualSignal(data));
}

function toQuestionOptionList(values: readonly string[]) {
  return values.map((value) => ({ label: value, value, conversationValue: normalizeText(value).toLowerCase() }));
}

export function getConsultationQuestions(data: OnboardingData): ConsultationQuestionStep[] {
  const consultation = normalizeConsultationProfile(data.consultation);
  const rawStyleDirection = normalizeText(data.consultation?.styleDirection || data.intent.styleDirection);
  const steps: ConsultationQuestionStep[] = [];

  if (!rawStyleDirection) {
    steps.push({
      key: "styleDirection",
      kind: "single",
      title: "Direção de estilo",
      prompt: "Qual linha sustenta melhor a sua imagem?",
      placeholder: "Escolha uma direção de estilo.",
      options: CONSULTATION_STYLE_DIRECTION_OPTIONS.map((choice) => ({
        label: choice.label,
        value: choice.value,
        conversationValue: choice.label.toLowerCase(),
      })),
    });
  }

  if (!consultation.desiredPerception) {
    steps.push({
      key: "desiredPerception",
      kind: "single",
      title: "Percepção desejada",
      prompt: "Como você quer ser percebido quando a roupa entra na sala?",
      placeholder: "Escolha a leitura que você quer projetar.",
      options: toQuestionOptionList(CONSULTATION_DESIRED_PERCEPTION_OPTIONS),
    });
  }

  if (!consultation.occasion) {
    steps.push({
      key: "occasion",
      kind: "single",
      title: "Ocasião principal",
      prompt: "Qual é o contexto que mais pede precisão agora?",
      placeholder: "Escolha a ocasião mais importante.",
      options: toQuestionOptionList(CONSULTATION_OCCASION_OPTIONS),
    });
  }

  const askOptional = shouldAskOptionalQuestions(data, consultation);

  if (askOptional && !consultation.boldness) {
    steps.push({
      key: "boldness",
      kind: "single",
      title: "Nível de ousadia",
      prompt: "Você quer uma leitura mais discreta, equilibrada ou marcante?",
      placeholder: "Escolha o ritmo visual.",
      options: CONSULTATION_BOLDNESS_OPTIONS.map((choice) => ({
        label: choice.label,
        value: choice.value,
        conversationValue: choice.conversationValue,
      })),
      optional: true,
      note: "Se preferir, eu sigo com uma leitura segura e neutra.",
    });
  }

  if (askOptional && !consultation.restrictions.length && !data.colors.avoidColors.length) {
    steps.push({
      key: "restrictions",
      kind: "multi",
      title: "Restrições",
      prompt: "Há algo que vale manter fora da curadoria?",
      placeholder: "Toque nas restrições que fazem sentido.",
      options: CONSULTATION_RESTRICTION_OPTIONS.map((value) => ({
        label: value,
        value,
        conversationValue: value.toLowerCase(),
      })),
      optional: true,
      multiple: true,
      note: "Eu trato isso como limite de styling, não como regra dura.",
    });
  }

  if (askOptional && !consultation.preferredColors.length && !data.colors.favoriteColors.length) {
    steps.push({
      key: "preferredColors",
      kind: "multi",
      title: "Cores preferidas",
      prompt: "Que famílias de cor te deixam mais confortável e coerente?",
      placeholder: "Escolha as famílias que fazem sentido.",
      options: CONSULTATION_COLOR_OPTIONS.map((value) => ({
        label: value,
        value,
        conversationValue: value.toLowerCase(),
      })),
      optional: true,
      multiple: true,
    });
  }

  if (askOptional && !consultation.bodyFocus && !data.body.highlight.length) {
    steps.push({
      key: "bodyFocus",
      kind: "single",
      title: "Foco corporal",
      prompt: "Onde você quer que a leitura trabalhe com mais intenção?",
      placeholder: "Escolha a área de foco.",
      options: toQuestionOptionList(CONSULTATION_BODY_FOCUS_OPTIONS),
      optional: true,
    });
  }

  if (askOptional && !consultation.aestheticVibe) {
    steps.push({
      key: "aestheticVibe",
      kind: "single",
      title: "Vibe estética",
      prompt: "Qual atmosfera visual te representa melhor hoje?",
      placeholder: "Escolha o tom da curadoria.",
      options: toQuestionOptionList(CONSULTATION_VIBE_OPTIONS),
      optional: true,
      note: "Quando a resposta é vaga, eu sigo pela linha mais segura e neutra.",
    });
  }

  return steps;
}

export function hasMinimumConsultationSignal(data: OnboardingData) {
  const consultation = normalizeConsultationProfile(data.consultation);
  return Boolean(
    consultation.styleDirection ||
      data.intent.styleDirection ||
      consultation.desiredPerception ||
      consultation.occasion ||
      consultation.boldness ||
      consultation.restrictions.length ||
      consultation.preferredColors.length ||
      consultation.avoidColors.length ||
      consultation.bodyFocus ||
      consultation.aestheticVibe ||
      hasContextualSignal(data),
  );
}

export function inferConsultationConfidenceSource(
  data: OnboardingData,
  consultation: ConsultationProfile,
): ConsultationConfidenceSource {
  if (consultation.confidenceSource) {
    return consultation.confidenceSource;
  }

  const hasConversation =
    Boolean(consultation.desiredPerception || consultation.occasion || consultation.boldness || consultation.restrictions.length) ||
    Boolean(data.intent.imageGoal || data.intent.mainPain || data.intent.styleDirection);
  const hasProfile = hasContextualSignal(data);

  if (hasConversation && hasProfile) return "mixed";
  if (hasConversation) return "conversation";
  if (hasProfile) return "profile";
  return defaultConsultationProfile.confidenceSource;
}

export function applyConsultationAnswer(
  stepKey: ConsultationQuestionKey,
  value: string | string[],
): Partial<ConsultationProfile> {
  if (stepKey === "styleDirection") {
    return { styleDirection: normalizeStyleDirectionPreference(normalizeText(value)) as StyleDirectionPreference | "" };
  }

  if (stepKey === "desiredPerception") {
    return { desiredPerception: normalizeText(value) };
  }

  if (stepKey === "occasion") {
    return { occasion: normalizeText(value) };
  }

  if (stepKey === "boldness") {
    const text = normalizeText(value).toLowerCase();
    if (text.includes("discreta") || text.includes("low")) return { boldness: "low" };
    if (text.includes("equilibr") || text.includes("medium")) return { boldness: "medium" };
    if (text.includes("marcante") || text.includes("high")) return { boldness: "high" };
    return { boldness: "" };
  }

  if (stepKey === "restrictions") {
    return { restrictions: normalizeList(value) };
  }

  if (stepKey === "preferredColors") {
    return { preferredColors: normalizeList(value) };
  }

  if (stepKey === "bodyFocus") {
    return { bodyFocus: normalizeText(value) };
  }

  if (stepKey === "aestheticVibe") {
    return { aestheticVibe: normalizeText(value) };
  }

  return {};
}
