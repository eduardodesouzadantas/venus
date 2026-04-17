"use client";

type ResolveOnboardingPhotoUrlInput = {
  storagePath: string;
  orgId?: string | null;
  orgSlug?: string | null;
};

type ResolveOnboardingPhotoUrlResponse = {
  signedUrl: string;
  expiresInSeconds: number;
};

export async function resolveOnboardingPhotoSignedUrl(input: ResolveOnboardingPhotoUrlInput): Promise<string> {
  if (!input.storagePath) {
    throw new Error("invalid_storage_path");
  }

  const response = await fetch("/api/onboarding/photo-signed-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      storagePath: input.storagePath,
      orgId: input.orgId || null,
      orgSlug: input.orgSlug || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `signed_url_failed_${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as ResolveOnboardingPhotoUrlResponse | null;
  if (!payload?.signedUrl) {
    throw new Error("signed_url_failed");
  }

  return payload.signedUrl;
}
