import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
        console.log("[TRYON_UPLOAD] Bucket not found, creating:", TRYON_BUCKET);
        const { error: createError } = await supabase.storage.createBucket(TRYON_BUCKET, {
            public: true,
            fileSizeLimit: TRYON_FILE_LIMIT,
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        });

        if (createError) {
            console.error("[TRYON_UPLOAD] Bucket creation failed:", createError.message);
            throw new Error("Failed to create storage bucket");
        }

        console.log("[TRYON_UPLOAD] Bucket created successfully:", TRYON_BUCKET);
        return;
    }

    // Ensure it's public
    if (!existing.public) {
        console.log("[TRYON_UPLOAD] Bucket exists but is not public, updating:", TRYON_BUCKET);
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

        console.log("[TRYON_UPLOAD] start", {
            hasFile: !!file,
            fileSize: file?.size ?? 0,
            fileType: file?.type ?? "n/a",
            orgId,
            bucket: TRYON_BUCKET,
        });

        if (!file) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        if (file.size > TRYON_FILE_LIMIT) {
            console.warn("[TRYON_UPLOAD] failure - file too large", { size: file.size, limit: TRYON_FILE_LIMIT });
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
            console.error("[TRYON_UPLOAD] failure", {
                bucket: TRYON_BUCKET,
                path: storagePath,
                orgId,
                error: uploadError.message,
            });
            return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from(TRYON_BUCKET)
            .getPublicUrl(storagePath);

        const publicUrl = urlData?.publicUrl || "";

        if (!publicUrl) {
            console.error("[TRYON_UPLOAD] failure - no public URL generated", {
                bucket: TRYON_BUCKET,
                path: storagePath,
            });
            return NextResponse.json({ error: "Failed to generate public URL" }, { status: 500 });
        }

        console.log("[TRYON_UPLOAD] success", {
            bucket: TRYON_BUCKET,
            path: storagePath,
            orgId,
            publicUrl: publicUrl.substring(0, 120),
        });

        return NextResponse.json({ publicUrl });
    } catch (error) {
        console.error("[TRYON_UPLOAD] failure", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
            { error: "Upload failed. Please try again." },
            { status: 500 }
        );
    }
}
