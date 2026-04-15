import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInMemoryRateLimit, logSecurityEvent, recordSecurityAlert } from "@/lib/reliability/security";

export const dynamic = "force-dynamic";

const TRYON_BUCKET = "products";
const TRYON_FILE_LIMIT = 10 * 1024 * 1024; // 10MB

/**
 * Ensures the storage bucket exists and is public.
 * Reuses the same "products" bucket used by the catalog.
 * If the bucket doesn't exist yet, creates it on-demand.
 */
async function ensureBucketExists(supabase: ReturnType<typeof createAdminClient>) {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error("[TRYON_UPLOAD] Failed to list buckets:", listError.message);
        throw new Error("Storage unavailable");
    }

    const existing = buckets?.find((b) => b.name === TRYON_BUCKET);

    if (!existing) {
        console.log("[TRYON_UPLOAD] Bucket not found, creating", { bucket: TRYON_BUCKET });
        const { error: createError } = await supabase.storage.createBucket(TRYON_BUCKET, {
            public: true,
            fileSizeLimit: TRYON_FILE_LIMIT,
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });

        if (createError) {
            console.error("[TRYON_UPLOAD] Bucket creation failed:", createError.message);
            throw new Error("Failed to create storage bucket");
        }

        console.log("[TRYON_UPLOAD] Bucket created successfully", { bucket: TRYON_BUCKET });
        return;
    }

    // Ensure it's public
    if (!existing.public) {
        console.log("[TRYON_UPLOAD] Bucket exists but is not public, updating", { bucket: TRYON_BUCKET });
        await supabase.storage.updateBucket(TRYON_BUCKET, {
            public: true,
            fileSizeLimit: TRYON_FILE_LIMIT,
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const orgId = ((formData.get("org_id") as string) || "unknown").trim();
        const alertOrgId = orgId === "unknown" ? "" : orgId;

        const rateLimit = checkInMemoryRateLimit({
            scope: "tryon_upload",
            request: req,
            limit: 12,
            windowMs: 10 * 60 * 1000,
            keyParts: [orgId || "unknown"],
        });

        if (!rateLimit.allowed) {
            logSecurityEvent("warn", "rate_limit_exceeded", {
                route: "tryon/upload",
                orgId,
                retryAfterSeconds: rateLimit.retryAfterSeconds,
                limit: rateLimit.limit,
            });

            if (alertOrgId) {
              await recordSecurityAlert(createAdminClient(), {
                orgId: alertOrgId,
                orgSlug: null,
                eventType: "security.rate_limited",
                summary: "Try-on upload rate limit exceeded",
                details: {
                    route: "tryon/upload",
                    retry_after_seconds: rateLimit.retryAfterSeconds,
                    limit: rateLimit.limit,
                },
              }).catch(() => null);
            }

            return NextResponse.json(
                { error: "rate_limited", retry_after_seconds: rateLimit.retryAfterSeconds },
                {
                    status: 429,
                    headers: { "Retry-After": String(rateLimit.retryAfterSeconds || 60) },
                }
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
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        if (file.size > TRYON_FILE_LIMIT) {
            logSecurityEvent("warn", "tryon_upload_file_too_large", {
                route: "tryon/upload",
                size: file.size,
                limit: TRYON_FILE_LIMIT,
            });
            return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Ensure bucket exists before upload
        await ensureBucketExists(supabase);

        const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const storagePath = `tryon-inputs/${orgId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${safeExt}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from(TRYON_BUCKET)
            .upload(storagePath, buffer, {
                contentType: file.type || "image/jpeg",
                upsert: false,
            });

        if (uploadError) {
            logSecurityEvent("error", "tryon_upload_failed", {
                route: "tryon/upload",
                bucket: TRYON_BUCKET,
                prefix: "tryon-inputs",
                error: uploadError.message,
            });
            return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from(TRYON_BUCKET)
            .getPublicUrl(storagePath);

        const publicUrl = urlData?.publicUrl || "";

        if (!publicUrl) {
            logSecurityEvent("error", "tryon_upload_public_url_missing", {
                route: "tryon/upload",
                bucket: TRYON_BUCKET,
                prefix: "tryon-inputs",
            });
            return NextResponse.json({ error: "Failed to generate public URL" }, { status: 500 });
        }

        logSecurityEvent("info", "tryon_upload_succeeded", {
            route: "tryon/upload",
            bucket: TRYON_BUCKET,
            prefix: "tryon-inputs",
            hasPublicUrl: !!publicUrl,
        });

        return NextResponse.json({ publicUrl });
    } catch (error) {
        logSecurityEvent("error", "tryon_upload_failed", {
            route: "tryon/upload",
            error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
            { error: "Upload failed. Please try again." },
            { status: 500 }
        );
    }
}
