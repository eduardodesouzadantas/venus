import type { Product } from "@/lib/catalog";

export type TargetProfile = "executiva" | "minimalista" | "criativa" | "clássica" | "aventureira" | "conservadora";

export interface CollectionSegment {
  profile: TargetProfile;
  label: string;
  productIds: string[];
  criteria: string[];
}

export interface CollectionTargetingPayload {
  orgId: string;
  collectionId: string;
  segments: CollectionSegment[];
  generatedAt: string;
  criteriaApplied: string[];
}

export interface CollectionTargetingInput {
  orgId: string;
  collection: Product[];
  profileSignals?: Record<string, unknown>;
}

const TARGET_PROFILE_MAP: Record<string, TargetProfile> = {
  executivo: "executiva",
  minimalista: "minimalista",
  criativa: "criativa",
  clássico: "clássica",
  classico: "clássica",
  aventureira: "aventureira",
  conservadora: "conservadora",
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value);
}

function inferProfileFromSignals(signals: Record<string, unknown>): TargetProfile | null {
  const score: Record<TargetProfile, number> = {
    executiva: 0,
    minimalista: 0,
    criativa: 0,
    clássica: 0,
    aventureira: 0,
    conservadora: 0,
  };

  const styleDirection = normalizeString(signals.styleDirection).toLowerCase();
  const intent = normalizeString(signals.intent).toLowerCase();
  const imageGoal = normalizeString(signals.imageGoal).toLowerCase();

  if (styleDirection.includes("executiva") || imageGoal.includes("autoridade")) {
    score.executiva += 3;
  }
  if (styleDirection.includes("minimalista") || intent.includes("clean")) {
    score.minimalista += 3;
  }
  if (styleDirection.includes("criativa") || imageGoal.includes("destaque")) {
    score.criativa += 3;
  }
  if (styleDirection.includes("clássica") || styleDirection.includes("classico")) {
    score.clássica += 3;
  }
  if (styleDirection.includes("aventureira") || intent.includes("moderno")) {
    score.aventureira += 3;
  }
  if (styleDirection.includes("conservadora") || intent.includes("seguro")) {
    score.conservadora += 3;
  }

  const targetProfile = normalizeString(signals.targetProfile).toLowerCase();
  if (targetProfile && TARGET_PROFILE_MAP[targetProfile]) {
    score[TARGET_PROFILE_MAP[targetProfile]] += 5;
  }

  let maxScore = 0;
  let bestProfile: TargetProfile | null = null;

  for (const [profile, value] of Object.entries(score)) {
    if (value > maxScore) {
      maxScore = value;
      bestProfile = profile as TargetProfile;
    }
  }

  return maxScore > 0 ? bestProfile : null;
}

function filterProductsByProfile(
  products: Product[],
  profile: TargetProfile
): Product[] {
  return products.filter((product) => {
    const productProfiles = product.target_profile || [];
    if (productProfiles.length === 0) return false;

    return productProfiles.some(
      (p) => normalizeString(p).toLowerCase() === profile.toLowerCase()
    );
  });
}

export function generateCollectionTargeting(
  input: CollectionTargetingInput
): CollectionTargetingPayload {
  const orgId = normalizeString(input.orgId);
  const allProducts = input.collection || [];
  const profileSignals = input.profileSignals || {};

  if (!orgId) {
    return {
      orgId: "",
      collectionId: "",
      segments: [],
      generatedAt: new Date().toISOString(),
      criteriaApplied: ["org_id ausente"],
    };
  }

  const collection = allProducts.filter(
    (p) => normalizeString(p.org_id) === orgId
  );

  const segments: CollectionSegment[] = [];
  const criteriaApplied: string[] = ["org_id validado"];

  const inferredProfile = inferProfileFromSignals(profileSignals);

  if (inferredProfile) {
    const filteredProducts = filterProductsByProfile(collection, inferredProfile);
    segments.push({
      profile: inferredProfile,
      label: inferredProfile.charAt(0).toUpperCase() + inferredProfile.slice(1),
      productIds: filteredProducts.map((p) => p.id),
      criteria: [`perfil inferido: ${inferredProfile}`],
    });
    criteriaApplied.push(`perfil inferido: ${inferredProfile}`);
  }

  const profilesToAnalyze: TargetProfile[] = [
    "executiva",
    "minimalista",
    "criativa",
    "clássica",
    "aventureira",
    "conservadora",
  ];

  for (const profile of profilesToAnalyze) {
    if (inferredProfile && profile === inferredProfile) continue;

    const filteredProducts = filterProductsByProfile(collection, profile);
    if (filteredProducts.length > 0) {
      segments.push({
        profile,
        label: profile.charAt(0).toUpperCase() + profile.slice(1),
        productIds: filteredProducts.map((p) => p.id),
        criteria: [`produtos匹配 perfil: ${profile}`],
      });
      criteriaApplied.push(`segmento: ${profile}`);
    }
  }

  return {
    orgId,
    collectionId: `col-${orgId}-${Date.now()}`,
    segments,
    generatedAt: new Date().toISOString(),
    criteriaApplied,
  };
}

export function extractProfilesFromCollection(
  collection: Product[]
): TargetProfile[] {
  const profileSet = new Set<TargetProfile>();

  for (const product of collection) {
    const profiles = product.target_profile || [];
    for (const rawProfile of profiles) {
      const normalized = normalizeString(rawProfile).toLowerCase();
      if (TARGET_PROFILE_MAP[normalized]) {
        profileSet.add(TARGET_PROFILE_MAP[normalized]);
      }
    }
  }

  return Array.from(profileSet);
}