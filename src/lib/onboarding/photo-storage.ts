export const ONBOARDING_PHOTO_BUCKET = "onboarding-photos";
export const ONBOARDING_PHOTO_FILE_LIMIT = 6 * 1024 * 1024;
export const ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS = 600;

const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type OnboardingPhotoKind = "face" | "body";

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function sanitizeStorageSegment(value: unknown, fallback = "") {
  const normalized = normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
  const candidate = normalized || fallback;
  return SAFE_SEGMENT_PATTERN.test(candidate) ? candidate : "";
}

export function sanitizeOnboardingPhotoKind(value: unknown): OnboardingPhotoKind | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "face" || normalized === "body") {
    return normalized;
  }
  return null;
}

export function isAllowedOnboardingImageMimeType(value: unknown) {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export function detectOnboardingImageMimeType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function getOnboardingPhotoExtension(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "";
  }
}

export function buildOnboardingPhotoStoragePath(input: {
  orgId?: string | null;
  orgSlug?: string | null;
  kind: unknown;
  journeyId?: string | null;
  sessionId?: string | null;
  mimeType: string;
}) {
  const orgSegment = sanitizeStorageSegment(input.orgId || input.orgSlug || "", "");
  const kind = sanitizeOnboardingPhotoKind(input.kind);
  const sessionSegment = sanitizeStorageSegment(input.journeyId || input.sessionId || `${Date.now()}`, "");
  const ext = getOnboardingPhotoExtension(input.mimeType);

  if (!orgSegment || !kind || !sessionSegment || !ext) {
    return null;
  }

  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `onboarding-inputs/${orgSegment}/${kind}/${sessionSegment}-${randomSuffix}.${ext}`;
}

export function isValidOnboardingPhotoStoragePath(storagePath: string, orgId?: string | null, orgSlug?: string | null) {
  const normalized = normalizeText(storagePath);
  if (!normalized || normalized.length > 512) return false;
  if (normalized.includes("..") || normalized.includes("\\") || normalized.includes("//")) return false;
  if (!normalized.startsWith("onboarding-inputs/")) return false;

  const parts = normalized.split("/");
  if (parts.length < 4) return false;

  const [, scopeSegment, kindSegment, fileName] = parts;
  if (!SAFE_SEGMENT_PATTERN.test(scopeSegment) || !SAFE_SEGMENT_PATTERN.test(kindSegment)) return false;
  if (kindSegment !== "face" && kindSegment !== "body") return false;
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(fileName)) return false;

  const expectedScope = sanitizeStorageSegment(orgId || orgSlug || "", "");
  if (expectedScope && scopeSegment !== expectedScope) return false;

  return true;
}
