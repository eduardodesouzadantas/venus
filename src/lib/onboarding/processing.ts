import type { OnboardingData } from "@/types/onboarding";
import type { UserJourneyState } from "@/lib/user/journey";

export type ProcessingTenantSnapshot = {
  orgId: string;
  orgSlug: string;
  branchName: string | null;
  whatsappNumber: string | null;
};

export type ProcessingReadiness = {
  tenant: ProcessingTenantSnapshot | null;
  hasTenant: boolean;
  hasVisualInput: boolean;
  hasFallback: boolean;
  failureReason: "PROCESSING_MISSING_TENANT" | "PROCESSING_MISSING_PHOTO" | null;
};

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveProcessingTenant(
  data: OnboardingData,
  orgSlugFromQuery: string | null | undefined,
  journey?: UserJourneyState | null,
) {
  const resolvedOrgSlug = normalize(data.tenant?.orgSlug || journey?.onboardingSeed?.tenant?.orgSlug || orgSlugFromQuery);
  const resolvedOrgId = normalize(data.tenant?.orgId || journey?.onboardingSeed?.tenant?.orgId);

  const tenant: ProcessingTenantSnapshot | null = resolvedOrgId || resolvedOrgSlug
    ? {
        orgId: resolvedOrgId,
        orgSlug: resolvedOrgSlug,
        branchName: data.tenant?.branchName || journey?.onboardingSeed?.tenant?.branchName || null,
        whatsappNumber: data.tenant?.whatsappNumber || journey?.onboardingSeed?.tenant?.whatsappNumber || null,
      }
    : null;

  const hasVisualInput = Boolean(data.scanner?.facePhoto || data.scanner?.bodyPhoto);
  const hasFallback = Boolean(data.scanner?.skipped);

  return {
    tenant,
    hasTenant: Boolean(tenant),
    hasVisualInput,
    hasFallback,
  };
}

export function buildProcessingReadiness(
  data: OnboardingData,
  orgSlugFromQuery: string | null | undefined,
  journey?: UserJourneyState | null,
): ProcessingReadiness {
  const { tenant, hasTenant, hasVisualInput, hasFallback } = resolveProcessingTenant(data, orgSlugFromQuery, journey);

  if (!hasTenant) {
    return {
      tenant,
      hasTenant,
      hasVisualInput,
      hasFallback,
      failureReason: "PROCESSING_MISSING_TENANT",
    };
  }

  if (!hasVisualInput && !hasFallback) {
    return {
      tenant,
      hasTenant,
      hasVisualInput,
      hasFallback,
      failureReason: "PROCESSING_MISSING_PHOTO",
    };
  }

  return {
    tenant,
    hasTenant,
    hasVisualInput,
    hasFallback,
    failureReason: null,
  };
}

export function buildProcessingPersistInput(
  data: OnboardingData,
  orgSlugFromQuery: string | null | undefined,
  journey?: UserJourneyState | null,
) {
  const readiness = buildProcessingReadiness(data, orgSlugFromQuery, journey);
  return {
    readiness,
    payload: readiness.tenant
      ? {
          ...data,
          tenant: {
            ...data.tenant,
            orgId: readiness.tenant.orgId || data.tenant?.orgId || "",
            orgSlug: readiness.tenant.orgSlug || data.tenant?.orgSlug || "",
            branchName: readiness.tenant.branchName || data.tenant?.branchName || undefined,
            whatsappNumber: readiness.tenant.whatsappNumber || data.tenant?.whatsappNumber || undefined,
          },
        }
      : data,
  };
}
