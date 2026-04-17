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
  hasInlineImage: boolean;
  failureReason: "PROCESSING_MISSING_TENANT" | "PROCESSING_MISSING_PHOTO" | "PAYLOAD_TOO_LARGE_PREVENTED" | null;
};

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isInlineImageReference(value: string | null | undefined) {
  const normalized = normalize(value);
  return /^data:image\//i.test(normalized) || (normalized.length > 200_000 && !/^https?:\/\//i.test(normalized) && !normalized.startsWith("/"));
}

function getPhotoReference(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

export function resolveProcessingTenant(
  data: OnboardingData,
  orgSlugFromQuery: string | null | undefined,
  journey?: UserJourneyState | null,
) {
  const resolvedOrgSlug = normalize(data.tenant?.orgSlug || journey?.onboardingSeed?.tenant?.orgSlug || orgSlugFromQuery);
  const resolvedOrgId = normalize(data.tenant?.orgId || journey?.onboardingSeed?.tenant?.orgId);
  const facePhotoReference = getPhotoReference(data.scanner?.facePhotoPath, data.scanner?.facePhotoUrl, data.scanner?.facePhoto);
  const bodyPhotoReference = getPhotoReference(data.scanner?.bodyPhotoPath, data.scanner?.bodyPhotoUrl, data.scanner?.bodyPhoto);
  const hasInlineImage = [data.scanner?.facePhoto, data.scanner?.bodyPhoto, data.scanner?.facePhotoUrl, data.scanner?.bodyPhotoUrl, data.scanner?.facePhotoPath, data.scanner?.bodyPhotoPath]
    .some((value) => isInlineImageReference(value));

  const tenant: ProcessingTenantSnapshot | null = resolvedOrgId || resolvedOrgSlug
    ? {
      orgId: resolvedOrgId,
      orgSlug: resolvedOrgSlug,
        branchName: data.tenant?.branchName || journey?.onboardingSeed?.tenant?.branchName || null,
        whatsappNumber: data.tenant?.whatsappNumber || journey?.onboardingSeed?.tenant?.whatsappNumber || null,
      }
    : null;

  const hasVisualInput = Boolean(facePhotoReference || bodyPhotoReference);
  const hasFallback = Boolean(data.scanner?.skipped);

  return {
    tenant,
    hasTenant: Boolean(tenant),
    hasVisualInput,
    hasFallback,
    hasInlineImage,
  };
}

export function buildProcessingReadiness(
  data: OnboardingData,
  orgSlugFromQuery: string | null | undefined,
  journey?: UserJourneyState | null,
): ProcessingReadiness {
  const { tenant, hasTenant, hasVisualInput, hasFallback, hasInlineImage } = resolveProcessingTenant(data, orgSlugFromQuery, journey);

  if (!hasTenant) {
    return {
      tenant,
      hasTenant,
      hasVisualInput,
      hasFallback,
      hasInlineImage,
      failureReason: "PROCESSING_MISSING_TENANT",
    };
  }

  if (hasInlineImage) {
    return {
      tenant,
      hasTenant,
      hasVisualInput,
      hasFallback,
      hasInlineImage,
      failureReason: "PAYLOAD_TOO_LARGE_PREVENTED",
    };
  }

  if (!hasVisualInput && !hasFallback) {
    return {
      tenant,
      hasTenant,
      hasVisualInput,
      hasFallback,
      hasInlineImage,
      failureReason: "PROCESSING_MISSING_PHOTO",
    };
  }

  return {
    tenant,
    hasTenant,
    hasVisualInput,
    hasFallback,
    hasInlineImage,
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
          scanner: {
            ...data.scanner,
            facePhoto: getPhotoReference(data.scanner?.facePhotoUrl, data.scanner?.facePhotoPath, data.scanner?.facePhoto),
            bodyPhoto: getPhotoReference(data.scanner?.bodyPhotoUrl, data.scanner?.bodyPhotoPath, data.scanner?.bodyPhoto),
            facePhotoUrl: getPhotoReference(data.scanner?.facePhotoUrl, data.scanner?.facePhotoPath, data.scanner?.facePhoto),
            bodyPhotoUrl: getPhotoReference(data.scanner?.bodyPhotoUrl, data.scanner?.bodyPhotoPath, data.scanner?.bodyPhoto),
            facePhotoPath: normalize(data.scanner?.facePhotoPath),
            bodyPhotoPath: normalize(data.scanner?.bodyPhotoPath),
          },
        }
      : data,
  };
}
