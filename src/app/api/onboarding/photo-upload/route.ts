import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInMemoryRateLimit, logSecurityEvent, recordSecurityAlert } from "@/lib/reliability/security";

export const dynamic = "force-dynamic";

const ONBOARDING_BUCKET = "onboarding-photos";
const PHOTO_FILE_LIMIT = 6 * 1024 * 1024;

async function ensureBucketExists(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("[ONBOARDING_UPLOAD] failed to list buckets", listError.message);
    throw new Error("storage_unavailable");
  }

  const existing = buckets?.find((bucket) => bucket.name === ONBOARDING_BUCKET);
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(ONBOARDING_BUCKET, {
      public: true,
      fileSizeLimit: PHOTO_FILE_LIMIT,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    if (createError) {
      console.error("[ONBOARDING_UPLOAD] bucket creation failed", createError.message);
      throw new Error("bucket_creation_failed");
    }
    return;
  }

  if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(ONBOARDING_BUCKET, {
      public: true,
      fileSizeLimit: PHOTO_FILE_LIMIT,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    if (updateError) {
      console.warn("[ONBOARDING_UPLOAD] bucket update failed", updateError.message);
    }
  }
}

function normalizeText(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orgId = normalizeText(formData.get("org_id"));
    const orgSlug = normalizeText(formData.get("org_slug"));
    const kind = normalizeText(formData.get("kind")) || "body";
    const journeyId = normalizeText(formData.get("journey_id"));
    const sessionId = normalizeText(formData.get("session_id"));

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

    if (file.size > PHOTO_FILE_LIMIT) {
      logSecurityEvent("warn", "onboarding_photo_too_large", {
        route: "onboarding/photo-upload",
        orgId: orgId || null,
        orgSlug: orgSlug || null,
        kind,
        size: file.size,
        limit: PHOTO_FILE_LIMIT,
      });
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }

    const supabase = createAdminClient();
    await ensureBucketExists(supabase);

    const safeExt = ["jpg", "jpeg", "png", "webp"].includes((file.name.split(".").pop() || "").toLowerCase()) ? (file.name.split(".").pop() || "jpg").toLowerCase() : "jpg";
    const scopeParts = [orgId || orgSlug || "global", kind, journeyId || sessionId || Date.now().toString()];
    const storagePath = `onboarding-inputs/${scopeParts.join("/")}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const { error: uploadError } = await supabase.storage.from(ONBOARDING_BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "image/jpeg",
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

    const { data: urlData } = supabase.storage.from(ONBOARDING_BUCKET).getPublicUrl(storagePath);
    const photoUrl = urlData?.publicUrl || "";

    if (!photoUrl) {
      return NextResponse.json({ error: "missing_public_url" }, { status: 500 });
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
      bucket: ONBOARDING_BUCKET,
      hasPublicUrl: Boolean(photoUrl),
    });

    return NextResponse.json({
      bucket: ONBOARDING_BUCKET,
      storagePath,
      photoUrl,
      mimeType: file.type || "image/jpeg",
      size: file.size,
    });
  } catch (error) {
    logSecurityEvent("error", "onboarding_photo_upload_failed", {
      route: "onboarding/photo-upload",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
