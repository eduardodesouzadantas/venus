function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toBoolean(value: unknown) {
  const text = normalizeText(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "on";
}

function parseList(value: string | undefined | null) {
  return normalizeText(value)
    .split(/[,\n;]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function matchesPilotTarget(candidate: string, targets: string[]) {
  const normalizedCandidate = normalizeText(candidate).toLowerCase();
  if (!normalizedCandidate) return false;

  return targets.some((target) => normalizeText(target).toLowerCase() === normalizedCandidate);
}

export function isOnboardingWowSurfaceEnabled(input?: { orgSlug?: string | null; orgId?: string | null }) {
  const isFeatureEnabled = toBoolean(process.env.NEXT_PUBLIC_ONBOARDING_WOW_ENABLED ?? "true");

  if (!isFeatureEnabled) {
    return false;
  }

  const legacyTarget = process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ENABLED;
  if (legacyTarget) {
    const legacyOrgs = [
      ...parseList(process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORGS),
      ...parseList(process.env.NEXT_PUBLIC_ONBOARDING_LEGACY_ORG_IDS),
    ];

    if (legacyOrgs.length > 0) {
      const isLegacyOrg = Boolean(
        (input?.orgSlug && matchesPilotTarget(input.orgSlug, legacyOrgs)) ||
          (input?.orgId && matchesPilotTarget(input.orgId, legacyOrgs))
      );
      if (isLegacyOrg) {
        return false;
      }
    }
  }

  return true;
}

