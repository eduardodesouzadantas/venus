import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const orgId = (formData.get("org_id") as string) || "unknown";

        if (!file) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        const supabase = createAdminClient();

        const ext = file.name?.split(".").pop() || "jpg";
        const filename = `tryon-uploads/${orgId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from("products")
            .upload(filename, buffer, {
                contentType: file.type || "image/jpeg",
                upsert: false,
            });

        if (uploadError) {
            console.error("[tryon/upload] Upload failed:", uploadError);
            return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from("products")
            .getPublicUrl(filename);

        const publicUrl = urlData?.publicUrl || "";

        if (!publicUrl) {
            return NextResponse.json({ error: "Failed to generate public URL" }, { status: 500 });
        }

        console.log("[tryon/upload] Success:", { filename, publicUrl: publicUrl.substring(0, 100) });

        return NextResponse.json({ publicUrl });
    } catch (error) {
        console.error("[tryon/upload] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 }
        );
    }
}
