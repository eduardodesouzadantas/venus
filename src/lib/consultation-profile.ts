import { normalizeStyleDirectionPreference, type StyleDirectionPreference } from "@/lib/style-direction";

export type ConsultationBoldness = "low" | "medium" | "high" | "";
export type ConsultationConfidenceSource = "conversation" | "photo" | "mixed" | "profile" | "";

export type ConsultationProfile = {
  styleDirection: StyleDirectionPreference | "";
  desiredPerception: string;
  occasion: string;
  boldness: ConsultationBoldness;
  restrictions: string[];
  preferredColors: string[];
  avoidColors: string[];
  bodyFocus: string;
  aestheticVibe: string;
  confidenceSource: ConsultationConfidenceSource;
};

export const defaultConsultationProfile: ConsultationProfile = {
  styleDirection: "",
  desiredPerception: "",
  occasion: "",
  boldness: "",
  restrictions: [],
  preferredColors: [],
  avoidColors: [],
  bodyFocus: "",
  aestheticVibe: "",
  confidenceSource: "",
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeText(entry)).filter(Boolean);
}

function normalizeBoldness(value: unknown): ConsultationBoldness {
  const text = normalizeText(value).toLowerCase();
  if (!text) return "";
  if (text.includes("alta") || text.includes("high") || text.includes("ousada")) return "high";
  if (text.includes("média") || text.includes("media") || text.includes("medium")) return "medium";
  if (text.includes("baixa") || text.includes("low") || text.includes("discreta")) return "low";
  return "";
}

function normalizeConfidenceSource(value: unknown): ConsultationConfidenceSource {
  const text = normalizeText(value).toLowerCase();
  if (!text) return "";
  if (text.includes("mixed") || text.includes("mista")) return "mixed";
  if (text.includes("photo") || text.includes("foto")) return "photo";
  if (text.includes("profile") || text.includes("perfil")) return "profile";
  if (text.includes("conversation") || text.includes("conversa")) return "conversation";
  return "";
}

export function normalizeConsultationProfile(input?: Partial<ConsultationProfile> | null): ConsultationProfile {
  return {
    styleDirection: normalizeStyleDirectionPreference(input?.styleDirection || ""),
    desiredPerception: normalizeText(input?.desiredPerception),
    occasion: normalizeText(input?.occasion),
    boldness: normalizeBoldness(input?.boldness),
    restrictions: normalizeList(input?.restrictions),
    preferredColors: normalizeList(input?.preferredColors),
    avoidColors: normalizeList(input?.avoidColors),
    bodyFocus: normalizeText(input?.bodyFocus),
    aestheticVibe: normalizeText(input?.aestheticVibe),
    confidenceSource: normalizeConfidenceSource(input?.confidenceSource),
  };
}

export function buildConsultationProfileSummary(profile: ConsultationProfile): string {
  const parts = [
    `styleDirection=${profile.styleDirection || "n/a"}`,
    `desiredPerception=${profile.desiredPerception || "n/a"}`,
    `occasion=${profile.occasion || "n/a"}`,
    `boldness=${profile.boldness || "n/a"}`,
    `restrictions=${profile.restrictions.join(", ") || "n/a"}`,
    `preferredColors=${profile.preferredColors.join(", ") || "n/a"}`,
    `avoidColors=${profile.avoidColors.join(", ") || "n/a"}`,
    `bodyFocus=${profile.bodyFocus || "n/a"}`,
    `aestheticVibe=${profile.aestheticVibe || "n/a"}`,
    `confidenceSource=${profile.confidenceSource || "n/a"}`,
  ];

  return parts.join(" | ");
}

export function mergeConsultationProfiles(
  base?: Partial<ConsultationProfile> | null,
  patch?: Partial<ConsultationProfile> | null,
): ConsultationProfile {
  return normalizeConsultationProfile({
    ...(base || {}),
    ...(patch || {}),
    restrictions: patch?.restrictions?.length ? patch.restrictions : base?.restrictions,
    preferredColors: patch?.preferredColors?.length ? patch.preferredColors : base?.preferredColors,
    avoidColors: patch?.avoidColors?.length ? patch.avoidColors : base?.avoidColors,
  });
}

export function hasMeaningfulConsultationProfile(profile?: Partial<ConsultationProfile> | null): boolean {
  const normalized = normalizeConsultationProfile(profile);
  return Boolean(
    normalized.styleDirection ||
      normalized.desiredPerception ||
      normalized.occasion ||
      normalized.boldness ||
      normalized.restrictions.length ||
      normalized.preferredColors.length ||
      normalized.avoidColors.length ||
      normalized.bodyFocus ||
      normalized.aestheticVibe ||
      normalized.confidenceSource,
  );
}
