import { defaultOnboardingData, type OnboardingData } from "@/types/onboarding";

const ONBOARDING_STORAGE_PREFIX = "venus_onboarding";
const LEGACY_ONBOARDING_STORAGE_KEY = "venus_onboarding";

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") : "";
}

export function buildOnboardingStorageKey(userId: string | null | undefined, orgSlug: string | null | undefined) {
  return [ONBOARDING_STORAGE_PREFIX, userId || "guest", orgSlug || "global"].join(":");
}

function safeParseOnboardingData(raw: string | null): Partial<OnboardingData> | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<OnboardingData>;
  } catch {
    return null;
  }
}

export function mergeOnboardingData(parsed: Partial<OnboardingData>, queryOrgSlug: string): OnboardingData {
  return {
    ...defaultOnboardingData,
    ...parsed,
    intent: {
      ...defaultOnboardingData.intent,
      ...(parsed.intent || {}),
    },
    lifestyle: {
      ...defaultOnboardingData.lifestyle,
      ...(parsed.lifestyle || {}),
    },
    colors: {
      ...defaultOnboardingData.colors,
      ...(parsed.colors || {}),
    },
    body: {
      ...defaultOnboardingData.body,
      ...(parsed.body || {}),
    },
    scanner: {
      ...defaultOnboardingData.scanner,
      ...(parsed.scanner || {}),
    },
    colorimetry: {
      ...defaultOnboardingData.colorimetry,
      ...(parsed.colorimetry || {}),
    },
    conversation: {
      ...defaultOnboardingData.conversation,
      ...(parsed.conversation || {}),
    },
    tenant: {
      ...defaultOnboardingData.tenant,
      ...(parsed.tenant || {}),
      orgSlug: queryOrgSlug || parsed.tenant?.orgSlug,
    },
  } as OnboardingData;
}

export function hydrateOnboardingStorage(input: {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
  userId?: string | null;
  queryOrgSlug?: string | null;
}) {
  const normalizedOrgSlug = normalize(input.queryOrgSlug);
  const scopedKey = buildOnboardingStorageKey(input.userId || null, normalizedOrgSlug || null);
  const anonymousKey = buildOnboardingStorageKey(null, normalizedOrgSlug || null);

  const candidates = [scopedKey, anonymousKey, LEGACY_ONBOARDING_STORAGE_KEY];
  let raw: string | null = null;
  let sourceKey: string | null = null;

  for (const key of candidates) {
    const candidate = input.storage.getItem(key);
    if (candidate) {
      raw = candidate;
      sourceKey = key;
      break;
    }
  }

  if (!raw) {
    const storageKeyPrefix = [ONBOARDING_STORAGE_PREFIX, input.userId || "guest"].join(":");
    for (let index = 0; index < input.storage.length; index += 1) {
      const key = input.storage.key(index);
      if (!key || !key.startsWith(`${storageKeyPrefix}:`)) {
        continue;
      }

      const candidate = input.storage.getItem(key);
      if (candidate) {
        raw = candidate;
        sourceKey = key;
        break;
      }
    }
  }

  const parsed = safeParseOnboardingData(raw);
  if (!parsed) {
    return {
      data: null,
      storageKey: scopedKey,
      sourceKey,
      migrated: false,
    };
  }

  const merged = mergeOnboardingData(parsed, normalizedOrgSlug);
  const targetKey = buildOnboardingStorageKey(input.userId || null, normalizedOrgSlug || merged.tenant?.orgSlug || null);
  const migrated = Boolean(sourceKey && sourceKey !== targetKey);

  if (migrated) {
    input.storage.setItem(targetKey, JSON.stringify(merged));
    if (sourceKey === LEGACY_ONBOARDING_STORAGE_KEY) {
      input.storage.removeItem(LEGACY_ONBOARDING_STORAGE_KEY);
    }
  }

  return {
    data: merged,
    storageKey: targetKey,
    sourceKey,
    migrated,
  };
}

export function persistOnboardingStorage(input: {
  storage: Pick<Storage, "setItem">;
  userId?: string | null;
  queryOrgSlug?: string | null;
  data: OnboardingData;
}) {
  const normalizedOrgSlug = normalize(input.queryOrgSlug);
  const storageKey = buildOnboardingStorageKey(input.userId || null, normalizedOrgSlug || input.data.tenant?.orgSlug || null);
  input.storage.setItem(storageKey, JSON.stringify(input.data));
  return storageKey;
}
