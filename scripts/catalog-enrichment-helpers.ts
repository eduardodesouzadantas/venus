import type { StyleDirectionPreference } from "@/lib/style-direction";

export function normalizeStyleDirectionPreference(value: string | null | undefined): StyleDirectionPreference {
  if (!value) return "neutral";
  const v = value.toLowerCase().trim();
  if (v === "masculine" || v === "men" || v === "masc") return "masculine";
  if (v === "feminine" || v === "women" || v === "fem") return "feminine";
  return "neutral";
}

export function extractStyleDirectionFromTags(tags: string[] | null): StyleDirectionPreference {
  if (!tags) return "neutral";
  if (tags.includes("masculine")) return "masculine";
  if (tags.includes("feminine")) return "feminine";
  return "neutral";
}

export function deriveOccasionTags(usage: string | null): string[] {
  if (!usage) return [];
  const u = usage.toLowerCase();
  if (u === "casual") return ["casual"];
  if (u === "formal") return ["formal"];
  if (u === "sports") return ["sports"];
  if (u === "ethnic") return ["ethnic"];
  if (u === "party") return ["party"];
  return ["casual"];
}

export function deriveSeasonTags(season: string | null): string[] {
  if (!season) return [];
  const s = season.toLowerCase();
  if (s === "summer") return ["summer"];
  if (s === "winter") return ["winter"];
  if (s === "fall") return ["fall"];
  if (s === "spring") return ["spring"];
  if (s === "all seasons") return ["summer", "winter", "fall", "spring"];
  return [];
}

export function deriveFormality(usage: string | null): string {
  if (!usage) return "mixed";
  const u = usage.toLowerCase();
  if (u === "casual" || u === "sports") return "casual";
  if (u === "formal" || u === "ethnic") return "formal";
  return "mixed";
}

export function isApparelOrFootwear(masterCategory: string | null): boolean {
  if (!masterCategory) return false;
  return masterCategory === "Apparel" || masterCategory === "Footwear";
}

export interface ProductEnrichmentPatch {
  style_direction: StyleDirectionPreference;
  occasion_tags: string[];
  season_tags: string[];
  formality: string;
  stock_status: string;
  stock_qty: number;
  reserved_qty: number;
}

export function buildEnrichmentPatch(params: {
  tags: string[] | null;
  gender: string | null;
  masterCategory: string | null;
  usage: string | null;
  season: string | null;
}): ProductEnrichmentPatch {
  const { tags, gender, masterCategory, usage, season } = params;

  let styleDirection: StyleDirectionPreference = extractStyleDirectionFromTags(tags);
  if (styleDirection === "neutral" && isApparelOrFootwear(masterCategory)) {
    if (gender === "Men" || gender === "Boys") styleDirection = "masculine";
    else if (gender === "Women" || gender === "Girls") styleDirection = "feminine";
  }

  return {
    style_direction: styleDirection,
    occasion_tags: deriveOccasionTags(usage),
    season_tags: deriveSeasonTags(season),
    formality: deriveFormality(usage),
    stock_status: "in_stock",
    stock_qty: 10,
    reserved_qty: 0,
  };
}