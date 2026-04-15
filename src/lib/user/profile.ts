import type { OnboardingData } from "@/types/onboarding";

export type UserProfileRecord = {
  id: string;
  body_type: string | null;
  color_profile: Record<string, unknown>;
  style_profile: Record<string, unknown>;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserOrgProfileRecord = {
  id: string;
  org_id: string;
  user_id: string;
  purchase_history: unknown[];
  interactions: unknown[];
  last_state: string | null;
  engagement_score: number;
  created_at: string;
  updated_at: string;
};

export type UserTagRecord = {
  id: string;
  user_id: string;
  org_id: string | null;
  tag: string;
  tag_key: string;
  scope: "global" | "org";
  source: string;
  created_at: string;
};

export type UserJourneySnapshot = {
  profile: UserProfileRecord | null;
  orgProfile: UserOrgProfileRecord | null;
  tags: string[];
};

export type UserJourneySeed = Partial<OnboardingData> & {
  journey?: {
    mode?: string;
    lastState?: string | null;
  };
};

export type UserJourneyUpsertInput = {
  userId: string;
  orgId?: string | null;
  orgSlug?: string | null;
  onboardingData?: Partial<OnboardingData> | null;
  lastState?: string | null;
  existingOrgProfile?: Pick<UserOrgProfileRecord, "purchase_history" | "interactions" | "last_state" | "engagement_score"> | null;
  existingTags?: string[];
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTag(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasOnboardingCompletionSignals(data?: Partial<OnboardingData> | null) {
  if (!data) return false;

  const hasChat = Boolean(data.intent?.styleDirection || data.intent?.imageGoal || data.conversation?.styleDirection);
  const hasVisual = Boolean(data.scanner?.facePhoto || data.scanner?.bodyPhoto || data.scanner?.skipped);
  const hasProfile = Boolean(
    data.colorSeason ||
      data.faceShape ||
      data.idealFit ||
      data.idealNeckline ||
      data.idealFabrics?.length ||
      data.avoidFabrics?.length ||
      data.colorimetry?.colorSeason ||
      data.colorimetry?.idealFit
  );

  return hasChat && (hasVisual || hasProfile);
}

function scoreFromOnboarding(data?: Partial<OnboardingData> | null) {
  if (!data) return 0;

  let score = 20;
  if (data.intent?.styleDirection) score += 10;
  if (data.intent?.imageGoal) score += 10;
  if (data.intent?.satisfaction) score += Math.min(20, Math.max(0, Math.round(data.intent.satisfaction) * 2));
  if (data.lifestyle?.purchaseDna) score += 5;
  if (data.lifestyle?.purchaseBehavior) score += 5;
  if (data.colors?.colorSeason || data.colorSeason) score += 10;
  if (data.colors?.contrast || data.colorimetry?.contrast) score += 5;
  if (data.colors?.metal) score += 5;
  if (data.body?.fit || data.idealFit) score += 10;
  if (data.body?.faceLines) score += 5;
  if (data.scanner?.facePhoto) score += 10;
  if (data.scanner?.bodyPhoto) score += 10;
  if (data.scanner?.skipped) score += 5;

  return clampScore(score);
}

function buildColorProfile(data?: Partial<OnboardingData> | null) {
  const colors = asRecord(data?.colors);
  const colorimetry = asRecord(data?.colorimetry);

  return {
    skinTone: colorimetry.skinTone || colors.skinTone || "",
    undertone: colorimetry.undertone || colors.undertone || "",
    contrast: colorimetry.contrast || colors.contrast || "",
    colorSeason: colorimetry.colorSeason || colors.colorSeason || data?.colorSeason || "",
    faceShape: colorimetry.faceShape || colors.faceShape || data?.faceShape || "",
    idealNeckline: colorimetry.idealNeckline || colors.idealNeckline || data?.idealNeckline || "",
    idealFit: colorimetry.idealFit || colors.idealFit || data?.idealFit || "",
    idealFabrics: colorimetry.idealFabrics || colors.idealFabrics || data?.idealFabrics || [],
    avoidFabrics: colorimetry.avoidFabrics || colors.avoidFabrics || data?.avoidFabrics || [],
    favoriteColors: data?.favoriteColors || colors.favoriteColors || colorimetry.favoriteColors || [],
    avoidColors: data?.avoidColors || colors.avoidColors || colorimetry.avoidColors || [],
    metal: colors.metal || "",
  };
}

function buildStyleProfile(data?: Partial<OnboardingData> | null) {
  return {
    styleDirection: data?.intent?.styleDirection || "",
    imageGoal: data?.intent?.imageGoal || "",
    mainPain: data?.intent?.mainPain || "",
    lifestyle: {
      environments: data?.lifestyle?.environments || [],
      purchaseDna: data?.lifestyle?.purchaseDna || "",
      purchaseBehavior: data?.lifestyle?.purchaseBehavior || "",
    },
    body: {
      fit: data?.body?.fit || "",
      faceLines: data?.body?.faceLines || "",
      hairLength: data?.body?.hairLength || "",
      highlight: data?.body?.highlight || [],
      camouflage: data?.body?.camouflage || [],
    },
  };
}

function buildPreferences(data?: Partial<OnboardingData> | null) {
  return {
    favoriteColors: data?.favoriteColors || data?.colors?.favoriteColors || data?.colorimetry?.favoriteColors || [],
    avoidColors: data?.avoidColors || data?.colors?.avoidColors || data?.colorimetry?.avoidColors || [],
    imageGoal: data?.intent?.imageGoal || "",
    styleDirection: data?.intent?.styleDirection || "",
    line: data?.conversation?.line || "",
    avoidColorNote: data?.conversation?.avoidColorNote || "",
    satisfaction: data?.intent?.satisfaction ?? null,
    environments: data?.lifestyle?.environments || [],
    purchaseDna: data?.lifestyle?.purchaseDna || "",
    purchaseBehavior: data?.lifestyle?.purchaseBehavior || "",
    scannerSkipped: data?.scanner?.skipped || false,
  };
}

export function buildUserProfileUpsert(userId: string, onboardingData?: Partial<OnboardingData> | null) {
  return {
    id: userId,
    body_type: normalizeText(onboardingData?.body?.fit || onboardingData?.colors?.idealFit || onboardingData?.colorimetry?.idealFit) || null,
    color_profile: buildColorProfile(onboardingData),
    style_profile: buildStyleProfile(onboardingData),
    preferences: buildPreferences(onboardingData),
  };
}

function buildInteractionEntry(input: UserJourneyUpsertInput) {
  const onboardingData = input.onboardingData || {};
  const styleDirection = normalizeText(onboardingData.intent?.styleDirection);
  const imageGoal = normalizeText(onboardingData.intent?.imageGoal);
  const state = normalizeText(input.lastState) || "onboarding_chat";

  return {
    type: "journey_snapshot",
    state,
    org_id: input.orgId || null,
    org_slug: input.orgSlug || null,
    style_direction: styleDirection || null,
    image_goal: imageGoal || null,
    body_type: normalizeText(onboardingData.body?.fit || onboardingData.colors?.idealFit || onboardingData.colorimetry?.idealFit) || null,
    color_profile: buildColorProfile(onboardingData),
    style_profile: buildStyleProfile(onboardingData),
    preferences: buildPreferences(onboardingData),
    captured_at: new Date().toISOString(),
  };
}

export function buildUserOrgProfileUpsert(input: UserJourneyUpsertInput) {
  const onboardingData = input.onboardingData || {};
  const currentInteraction = buildInteractionEntry(input);
  const existingPurchaseHistory = Array.isArray(input.existingOrgProfile?.purchase_history)
    ? input.existingOrgProfile?.purchase_history || []
    : [];
  const existingInteractions = Array.isArray(input.existingOrgProfile?.interactions)
    ? input.existingOrgProfile?.interactions || []
    : [];
  const lastState = normalizeText(input.lastState) || normalizeText(input.existingOrgProfile?.last_state) || "onboarding_chat";
  const engagementScore = Math.max(
    input.existingOrgProfile?.engagement_score || 0,
    scoreFromOnboarding(onboardingData)
  );

  return {
    purchase_history: existingPurchaseHistory,
    interactions: [currentInteraction, ...existingInteractions].slice(0, 20),
    last_state: lastState,
    engagement_score: engagementScore,
  };
}

export function deriveUserTags(input: {
  existingTags?: string[];
  onboardingData?: Partial<OnboardingData> | null;
  orgProfile?: Pick<UserOrgProfileRecord, "purchase_history" | "engagement_score" | "last_state"> | null;
}) {
  const tags = new Set<string>();
  for (const tag of input.existingTags || []) {
    const normalized = normalizeTag(tag);
    if (normalized) tags.add(normalized);
  }

  const onboardingData = input.onboardingData || {};
  const orgProfile = input.orgProfile || null;

  const completed = hasOnboardingCompletionSignals(onboardingData) || normalizeText(orgProfile?.last_state) !== "";
  if (completed) {
    tags.add("onboarded");
  }

  if (orgProfile) {
    tags.add("returning");
  }

  if ((orgProfile?.purchase_history?.length || 0) > 0) {
    tags.add("buyer");
  }

  if ((orgProfile?.engagement_score || 0) >= 70) {
    tags.add("high_intent");
  }

  if ((orgProfile?.engagement_score || 0) >= 90 || (tags.has("buyer") && tags.has("high_intent"))) {
    tags.add("vip");
  }

  return Array.from(tags).filter(Boolean);
}

export function buildUserTagRows(input: {
  userId: string;
  orgId?: string | null;
  tags: string[];
  source?: string;
}) {
  const scope = input.orgId ? ("org" as const) : ("global" as const);
  return input.tags
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .map((tag) => ({
      user_id: input.userId,
      org_id: input.orgId || null,
      tag,
      tag_key: `${input.userId}:${scope}:${input.orgId || "global"}:${tag}`,
      scope,
      source: input.source || "journey",
    }));
}

export function buildOnboardingSeedFromSnapshot(
  snapshot: UserJourneySnapshot | null | undefined,
  org?: { id?: string | null; slug?: string | null; name?: string | null } | null
): Partial<OnboardingData> {
  const profile = snapshot?.profile;
  const orgProfile = snapshot?.orgProfile;
  const colorProfile = asRecord(profile?.color_profile);
  const styleProfile = asRecord(profile?.style_profile);
  const preferences = asRecord(profile?.preferences);
  const styleLifestyle = asRecord(styleProfile.lifestyle);
  const styleBody = asRecord(styleProfile.body);
  const interactions = Array.isArray(orgProfile?.interactions) ? orgProfile.interactions : [];
  const latestInteraction = interactions.length > 0 ? asRecord(interactions[0]) : {};
  const orgSlug = normalizeText(org?.slug || latestInteraction.org_slug);

  return {
    intent: {
      styleDirection: normalizeText(styleProfile.styleDirection) as OnboardingData["intent"]["styleDirection"],
      imageGoal: normalizeText(styleProfile.imageGoal),
      satisfaction: typeof preferences.satisfaction === "number" ? preferences.satisfaction : 5,
      mainPain: normalizeText(styleProfile.mainPain),
    },
    lifestyle: {
      environments: asStringArray(styleLifestyle.environments),
      purchaseDna: normalizeText(styleLifestyle.purchaseDna),
      purchaseBehavior: normalizeText(styleLifestyle.purchaseBehavior),
    },
    colors: {
      favoriteColors: asStringArray(colorProfile.favoriteColors),
      avoidColors: asStringArray(colorProfile.avoidColors),
      metal: normalizeText(colorProfile.metal) as OnboardingData["colors"]["metal"],
      colorSeason: normalizeText(colorProfile.colorSeason),
      skinTone: normalizeText(colorProfile.skinTone) as OnboardingData["colors"]["skinTone"],
      undertone: normalizeText(colorProfile.undertone) as OnboardingData["colors"]["undertone"],
      contrast: normalizeText(colorProfile.contrast) as OnboardingData["colors"]["contrast"],
      faceShape: normalizeText(colorProfile.faceShape) as OnboardingData["colors"]["faceShape"],
      idealNeckline: normalizeText(colorProfile.idealNeckline),
      idealFit: normalizeText(colorProfile.idealFit),
      idealFabrics: asStringArray(colorProfile.idealFabrics),
      avoidFabrics: asStringArray(colorProfile.avoidFabrics),
    },
    body: {
      highlight: asStringArray(styleBody.highlight),
      camouflage: asStringArray(styleBody.camouflage),
      fit: normalizeText(profile?.body_type) as OnboardingData["body"]["fit"],
      faceLines: normalizeText(styleBody.faceLines) as OnboardingData["body"]["faceLines"],
      hairLength: normalizeText(styleBody.hairLength) as OnboardingData["body"]["hairLength"],
    },
    scanner: {
      facePhoto: "",
      bodyPhoto: "",
      skipped: Boolean(preferences.scannerSkipped),
    },
    colorimetry: {
      skinTone: normalizeText(colorProfile.skinTone) as OnboardingData["colorimetry"]["skinTone"],
      undertone: normalizeText(colorProfile.undertone) as OnboardingData["colorimetry"]["undertone"],
      contrast: normalizeText(colorProfile.contrast) as OnboardingData["colorimetry"]["contrast"],
      colorSeason: normalizeText(colorProfile.colorSeason),
      favoriteColors: asStringArray(colorProfile.favoriteColors),
      avoidColors: asStringArray(colorProfile.avoidColors),
      faceShape: normalizeText(colorProfile.faceShape) as OnboardingData["colorimetry"]["faceShape"],
      idealNeckline: normalizeText(colorProfile.idealNeckline),
      idealFit: normalizeText(colorProfile.idealFit),
      idealFabrics: asStringArray(colorProfile.idealFabrics),
      avoidFabrics: asStringArray(colorProfile.avoidFabrics),
      justification: "",
    },
    favoriteColors: asStringArray(colorProfile.favoriteColors),
    avoidColors: asStringArray(colorProfile.avoidColors),
    colorSeason: normalizeText(colorProfile.colorSeason),
    faceShape: normalizeText(colorProfile.faceShape) as OnboardingData["faceShape"],
    idealNeckline: normalizeText(colorProfile.idealNeckline),
    idealFit: normalizeText(colorProfile.idealFit),
    idealFabrics: asStringArray(colorProfile.idealFabrics),
    avoidFabrics: asStringArray(colorProfile.avoidFabrics),
    conversation: {
      line: normalizeText(preferences.line) as OnboardingData["conversation"]["line"],
      imageGoal: normalizeText(preferences.imageGoal),
      styleDirection: normalizeText(preferences.styleDirection),
      avoidColorNote: normalizeText(preferences.avoidColorNote),
      favoriteColors: asStringArray(preferences.favoriteColors),
      avoidColors: asStringArray(preferences.avoidColors),
    },
    tenant: {
      orgId: normalizeText(org?.id || latestInteraction.org_id) || undefined,
      orgSlug: orgSlug || undefined,
    },
  };
}
