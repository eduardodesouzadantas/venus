"use client";

type OnboardingPhotoKind = "face" | "body";

export type UploadedOnboardingPhoto = {
  bucket: string;
  storagePath: string;
  signedUrl: string;
  mimeType: string;
  size: number;
  expiresInSeconds?: number;
};

type UploadOnboardingPhotoInput = {
  source: string | File;
  orgId: string;
  orgSlug?: string | null;
  kind: OnboardingPhotoKind;
  journeyId?: string | null;
  sessionId?: string | null;
  fileName?: string;
};

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.84;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function safeFileName(value: string, fallback: string) {
  const normalized = normalizeText(value).toLowerCase();
  const compact = normalized.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return compact || fallback;
}

async function sourceToFile(source: string | File, fileName: string): Promise<File> {
  if (source instanceof File) {
    return source;
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("photo_source_unreachable");
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

async function compressPhotoFile(file: File, fileName: string): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  try {
    const blob = file.slice(0, file.size, file.type);
    const objectUrl = URL.createObjectURL(blob);

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("photo_decode_failed"));
      img.src = objectUrl;
    });

    URL.revokeObjectURL(objectUrl);

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
      return file;
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    if (scale >= 1) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", JPEG_QUALITY);
    });

    if (!compressedBlob) {
      return file;
    }

    return new File([compressedBlob], fileName.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function prepareOnboardingPhotoUploadFile(input: UploadOnboardingPhotoInput): Promise<File> {
  const baseName = safeFileName(input.fileName || `${input.kind}-photo.jpg`, `${input.kind}-photo.jpg`);
  const file = await sourceToFile(input.source, baseName);
  return compressPhotoFile(file, baseName);
}

export async function uploadOnboardingPhoto(input: UploadOnboardingPhotoInput): Promise<UploadedOnboardingPhoto> {
  const file = await prepareOnboardingPhotoUploadFile(input);
  const formData = new FormData();
  formData.set("file", file);
  formData.set("org_id", input.orgId);
  formData.set("kind", input.kind);
  if (input.orgSlug) formData.set("org_slug", input.orgSlug);
  if (input.journeyId) formData.set("journey_id", input.journeyId);
  if (input.sessionId) formData.set("session_id", input.sessionId);

  const response = await fetch("/api/onboarding/photo-upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `photo_upload_failed_${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as Partial<UploadedOnboardingPhoto> | null;
  if (!payload?.signedUrl || !payload.storagePath || !payload.bucket) {
    throw new Error("photo_upload_invalid_response");
  }

  return payload as UploadedOnboardingPhoto;
}
