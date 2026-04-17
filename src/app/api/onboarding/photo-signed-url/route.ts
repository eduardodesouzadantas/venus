import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidOnboardingPhotoStoragePath,
  normalizeText,
  ONBOARDING_PHOTO_BUCKET,
  ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS,
  sanitizeStorageSegment,
} from "@/lib/onboarding/photo-storage";

export const dynamic = "force-dynamic";

type PhotoSignedUrlPayload = {
  storagePath?: string;
  orgId?: string;
  orgSlug?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as PhotoSignedUrlPayload | null;
    const storagePath = normalizeText(body?.storagePath);
    const orgId = sanitizeStorageSegment(body?.orgId, "");
    const orgSlug = sanitizeStorageSegment(body?.orgSlug, "");

    if (!isValidOnboardingPhotoStoragePath(storagePath, orgId || null, orgSlug || null)) {
      return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(ONBOARDING_PHOTO_BUCKET)
      .createSignedUrl(storagePath, ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresInSeconds: ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }
}
