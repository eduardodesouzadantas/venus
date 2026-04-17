import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInMemoryRateLimit, logSecurityEvent, recordSecurityAlert } from "@/lib/reliability/security";
import {
  buildOnboardingPhotoStoragePath,
  detectOnboardingImageMimeType,
  getOnboardingPhotoExtension,
  isAllowedOnboardingImageMimeType,
  isValidOnboardingPhotoStoragePath,
  ONBOARDING_PHOTO_BUCKET,
  ONBOARDING_PHOTO_FILE_LIMIT,
  ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS,
  sanitizeOnboardingPhotoKind,
  sanitizeStorageSegment,
} from "@/lib/onboarding/photo-storage";

export const dynamic = "force-dynamic";

async function ensureBucketExists(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("[ONBOARDING_UPLOAD] failed to list buckets", listError.message);
    throw new Error("storage_unavailable");
  }

  const existing = buckets?.find((bucket) => bucket.name === ONBOARDING_PHOTO_BUCKET);
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(ONBOARDING_PHOTO_BUCKET, {
      public: false,
      fileSizeLimit: ONBOARDING_PHOTO_FILE_LIMIT,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    if (createError) {
      console.error("[ONBOARDING_UPLOAD] bucket creation failed", createError.message);
      throw new Error("bucket_creation_failed");
    }
    return;
  }

  const { error: updateError } = await supabase.storage.updateBucket(ONBOARDING_PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: ONBOARDING_PHOTO_FILE_LIMIT,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (updateError) {
    console.warn("[ONBOARDING_UPLOAD] bucket update failed", updateError.message);
  }
}

function normalizeText(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orgId = sanitizeStorageSegment(formData.get("org_id"), "");
    const orgSlug = sanitizeStorageSegment(formData.get("org_slug"), "");
    const kind = sanitizeOnboardingPhotoKind(formData.get("kind")) || null;
    const journeyId = normalizeText(formData.get("journey_id"));
    const sessionId = normalizeText(formData.get("session_id"));

    if (!orgId && !orgSlug) {
      return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
    }

    if (!kind) {
      return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
    }

    const rateLimit = checkInMemoryRateLimit({
      scope: "onboarding_photo_upload",
      request: req,
      limit: 10,
      windowMs: 10 * 60 * 1000,
      keyParts: [orgId || orgSlug || "global", kind],
    });

    if (!rateLimit.allowed) {
      logSecurityEvent("warn", "rate_limit_exceeded", {
        route: "onboarding/photo-upload",
        orgId: orgId || null,
        orgSlug: orgSlug || null,
        kind,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        limit: rateLimit.limit,
      });
      return NextResponse.json(
        { error: "rate_limited", retry_after_seconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds || 60) } },
      );
    }

    if (!file) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    if (file.size > ONBOARDING_PHOTO_FILE_LIMIT) {
      logSecurityEvent("warn", "onboarding_photo_too_large", {
        route: "onboarding/photo-upload",
        orgId: orgId || null,
        orgSlug: orgSlug || null,
        kind,
        size: file.size,
        limit: ONBOARDING_PHOTO_FILE_LIMIT,
      });
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const detectedMimeType = detectOnboardingImageMimeType(fileBuffer.slice(0, 16));
    const providedMimeType = normalizeText(file.type).toLowerCase();

    if (!detectedMimeType || !isAllowedOnboardingImageMimeType(detectedMimeType)) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    if (providedMimeType && providedMimeType !== detectedMimeType) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    const fileExtension = getOnboardingPhotoExtension(detectedMimeType);
    const providedExtension = (file.name.split(".").pop() || "").toLowerCase();
    if (providedExtension && providedExtension !== fileExtension && providedExtension !== "jpeg") {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    const supabase = createAdminClient();
    await ensureBucketExists(supabase);

    const storagePath = buildOnboardingPhotoStoragePath({
      orgId: orgId || null,
      orgSlug: orgSlug || null,
      kind,
      journeyId: journeyId || null,
      sessionId: sessionId || null,
      mimeType: detectedMimeType,
    });

    if (!storagePath || !isValidOnboardingPhotoStoragePath(storagePath, orgId || null, orgSlug || null)) {
      return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage.from(ONBOARDING_PHOTO_BUCKET).upload(storagePath, fileBuffer, {
      contentType: detectedMimeType,
      upsert: false,
    });

    if (uploadError) {
      logSecurityEvent("error", "onboarding_photo_upload_failed", {
        route: "onboarding/photo-upload",
        orgId: orgId || null,
        orgSlug: orgSlug || null,
        kind,
        error: uploadError.message,
      });
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(ONBOARDING_PHOTO_BUCKET)
      .createSignedUrl(storagePath, ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      logSecurityEvent("error", "onboarding_photo_signed_url_failed", {
        route: "onboarding/photo-upload",
        orgId: orgId || null,
        orgSlug: orgSlug || null,
        kind,
        error: signedUrlError?.message || "missing_signed_url",
      });
      return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
    }

    if (orgId) {
      await recordSecurityAlert(createAdminClient(), {
        orgId,
        orgSlug: orgSlug || null,
        eventType: "onboarding.photo_uploaded",
        summary: "Onboarding photo uploaded",
        details: {
          route: "onboarding/photo-upload",
          kind,
          has_journey_id: Boolean(journeyId),
          has_session_id: Boolean(sessionId),
        },
      }).catch(() => null);
    }

    logSecurityEvent("info", "onboarding_photo_upload_succeeded", {
      route: "onboarding/photo-upload",
      orgId: orgId || null,
      orgSlug: orgSlug || null,
      kind,
      bucket: ONBOARDING_PHOTO_BUCKET,
      hasSignedUrl: Boolean(signedUrlData.signedUrl),
    });

    return NextResponse.json({
      bucket: ONBOARDING_PHOTO_BUCKET,
      storagePath,
      signedUrl: signedUrlData.signedUrl,
      mimeType: detectedMimeType,
      size: file.size,
      expiresInSeconds: ONBOARDING_PHOTO_SIGNED_URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    logSecurityEvent("error", "onboarding_photo_upload_failed", {
      route: "onboarding/photo-upload",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
