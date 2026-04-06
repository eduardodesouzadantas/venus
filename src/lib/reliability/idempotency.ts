import { createHash } from "node:crypto";

import type { OnboardingData } from "@/types/onboarding";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortDeep(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sortedEntries = Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return sortedEntries.reduce<Record<string, unknown>>((acc, [key, child]) => {
    acc[key] = sortDeep(child);
    return acc;
  }, {});
}

export function stableStringify(value: unknown) {
  return JSON.stringify(sortDeep(value));
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function stripOnboardingBinaryArtifacts(userData: OnboardingData): OnboardingData {
  return {
    ...userData,
    scanner: {
      ...userData.scanner,
      facePhoto: userData.scanner.facePhoto ? "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]" : "",
      bodyPhoto: userData.scanner.bodyPhoto ? "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]" : "",
    },
  };
}

export function createProcessAndPersistLeadIdempotencyKey(input: {
  orgId: string;
  source: string;
  userData: OnboardingData;
}) {
  const payload = {
    orgId: input.orgId,
    source: input.source,
    userData: stripOnboardingBinaryArtifacts(input.userData),
  };

  return `saved-result:${sha256Hex(stableStringify(payload) || "")}`;
}

export function createLeadStateIdempotencyKey(input: {
  orgId: string;
  leadId: string;
  hasStatus: boolean;
  status?: string | null;
  hasNextFollowUpAt: boolean;
  nextFollowUpAt?: string | null;
  expectedUpdatedAt?: string | null;
}) {
  const payload = {
    orgId: input.orgId,
    leadId: input.leadId,
    hasStatus: input.hasStatus,
    status: input.hasStatus ? input.status || null : null,
    hasNextFollowUpAt: input.hasNextFollowUpAt,
    nextFollowUpAt: input.hasNextFollowUpAt ? input.nextFollowUpAt || null : null,
    expectedUpdatedAt: input.expectedUpdatedAt || null,
  };

  return `lead-state:${sha256Hex(stableStringify(payload) || "")}`;
}
