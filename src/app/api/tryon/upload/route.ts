import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInMemoryRateLimit, logSecurityEvent, recordSecurityAlert } from "@/lib/reliability/security";
import {
  detectOnboardingImageMimeType,
  getOnboardingPhotoExtension,
  isAllowedOnboardingImageMimeType,
  sanitizeStorageSegment,
} from "@/lib/onboarding/photo-storage";

export const dynamic = "force-dynamic";

const TRYON_BUCKET = "tryon-inputs";
const TRYON_FILE_LIMIT = 10 * 1024 * 1024;
const TRYON_SIGNED_URL_EXPIRY_SECONDS = 600;

async function ensureBucketExists(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("[TRYON_UPLOAD] Failed to list buckets:", listError.message);
    throw new Error("storage_unavailable");
  }

  const existing = buckets?.find((bucket) => bucket.name === TRYON_BUCKET);
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(TRYON_BUCKET, {
      public: false,
      fileSizeLimit: TRYON_FILE_LIMIT,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    if (createError) {
      console.error("[TRYON_UPLOAD] Bucket creation failed:", createError.message);
      throw new Error("bucket_creation_failed");
    }
    return;
  }

  const { error: updateError } = await supabase.storage.updateBucket(TRYON_BUCKET, {
    public: false,
    fileSizeLimit: TRYON_FILE_LIMIT,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (updateError) {
    console.warn("[TRYON_UPLOAD] Bucket update failed:", updateError.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orgId = sanitizeStorageSegment(formData.get("org_id"), "");

    if (!orgId) {
      return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
    }

    const rateLimit = checkInMemoryRateLimit({
      scope: "tryon_upload",
      request: req,
      limit: 12,
      windowMs: 10 * 60 * 1000,
      keyParts: [orgId],
    });

    if (!rateLimit.allowed) {
      logSecurityEvent("warn", "rate_limit_exceeded", {
        route: "tryon/upload",
        orgId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        limit: rateLimit.limit,
      });

      await recordSecurityAlert(createAdminClient(), {
        orgId,
        orgSlug: null,
        eventType: "security.rate_limited",
        summary: "Try-on upload rate limit exceeded",
        details: {
          route: "tryon/upload",
          retry_after_seconds: rateLimit.retryAfterSeconds,
          limit: rateLimit.limit,
        },
      }).catch(() => null);

      return NextResponse.json(
        { error: "rate_limited", retry_after_seconds: rateLimit.retryAfterSeconds },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds || 60) },
        },
      );
    }

    logSecurityEvent("info", "tryon_upload_started", {
      route: "tryon/upload",
      hasFile: !!file,
      fileSize: file?.size ?? 0,
      fileType: file?.type ?? "n/a",
      bucket: TRYON_BUCKET,
    });

    if (!file) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    if (file.size > TRYON_FILE_LIMIT) {
      logSecurityEvent("warn", "tryon_upload_file_too_large", {
        route: "tryon/upload",
        size: file.size,
        limit: TRYON_FILE_LIMIT,
      });
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const detectedMimeType = detectOnboardingImageMimeType(fileBuffer.slice(0, 16));
    const providedMimeType = (file.type || "").trim().toLowerCase();

    if (!detectedMimeType || !isAllowedOnboardingImageMimeType(detectedMimeType)) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    if (providedMimeType && providedMimeType !== detectedMimeType) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    const providedExtension = (file.name.split(".").pop() || "").toLowerCase();
    const expectedExtension = getOnboardingPhotoExtension(detectedMimeType);
    if (providedExtension && providedExtension !== expectedExtension && providedExtension !== "jpeg") {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    const supabase = createAdminClient();
    await ensureBucketExists(supabase);

    const storagePath = `tryon-inputs/${orgId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${expectedExtension}`;

    const { error: uploadError } = await supabase.storage.from(TRYON_BUCKET).upload(storagePath, fileBuffer, {
      contentType: detectedMimeType,
      upsert: false,
    });

    if (uploadError) {
      logSecurityEvent("error", "tryon_upload_failed", {
        route: "tryon/upload",
        bucket: TRYON_BUCKET,
        prefix: "tryon-inputs",
        error: uploadError.message,
      });
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(TRYON_BUCKET)
      .createSignedUrl(storagePath, TRYON_SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      logSecurityEvent("error", "tryon_upload_signed_url_failed", {
        route: "tryon/upload",
        bucket: TRYON_BUCKET,
        prefix: "tryon-inputs",
        error: signedUrlError?.message || "missing_signed_url",
      });
      return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
    }

    logSecurityEvent("info", "tryon_upload_succeeded", {
      route: "tryon/upload",
      bucket: TRYON_BUCKET,
      prefix: "tryon-inputs",
      hasSignedUrl: true,
    });

    return NextResponse.json({
      bucket: TRYON_BUCKET,
      storagePath,
      signedUrl: signedUrlData.signedUrl,
      expiresInSeconds: TRYON_SIGNED_URL_EXPIRY_SECONDS,
    });
  } catch (error) {
    logSecurityEvent("error", "tryon_upload_failed", {
      route: "tryon/upload",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
