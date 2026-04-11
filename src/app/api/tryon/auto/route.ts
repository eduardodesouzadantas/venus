import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { getTryOnResult, getTryOnStatus } from "@/lib/tryon/client";

export const dynamic = "force-dynamic";

type TryOnAutoBody = {
  person_image_url?: string;
  garment_image_url?: string;
  org_id?: string;
  category?: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function detectCategory(value: string): "tops" | "bottoms" | "one-pieces" {
  const text = normalizeText(value).toLowerCase();
  if (text.includes("dress") || text.includes("vestido")) return "one-pieces";
  if (text.includes("calca") || text.includes("calÃ§a") || text.includes("saia") || text.includes("pants") || text.includes("skirt")) return "bottoms";
  return "tops";
}

function buildTryOnInput(personImageUrl: string, garmentImageUrl: string, category: string) {
  return {
    model_image: personImageUrl,
    garment_image: garmentImageUrl,
    category: detectCategory(category),
  };
}

function toRequestId(params: URLSearchParams) {
  return params.get("request_id") || params.get("id") || "";
}

export async function POST(req: NextRequest) {
  let body: TryOnAutoBody;

  try {
    body = (await req.json()) as TryOnAutoBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const personImageUrl = normalizeText(body.person_image_url);
  const garmentImageUrl = normalizeText(body.garment_image_url);
  const orgId = normalizeText(body.org_id);
  const category = normalizeText(body.category) || "tops";

  if (!personImageUrl || !garmentImageUrl) {
    return NextResponse.json({ error: "Missing required fields: person_image_url, garment_image_url" }, { status: 400 });
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "Missing FAL_KEY" }, { status: 500 });
  }

  fal.config({
    credentials: process.env.FAL_KEY,
  });

  let requestId = "";

  try {
    const run = fal.subscribe("fal-ai/fashn/tryon/v1.6", {
      input: buildTryOnInput(personImageUrl, garmentImageUrl, category),
      pollInterval: 2000,
      logs: true,
      onEnqueue: (id) => {
        requestId = id;
      },
    });

    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 8500);
    });

    const result = await Promise.race([run, timeout]);

    if (result && typeof result === "object" && "images" in result) {
      const generatedImageUrl = Array.isArray((result as { images?: Array<{ url?: string }> }).images)
        ? (result as { images: Array<{ url?: string }> }).images[0]?.url || ""
        : "";

      if (generatedImageUrl) {
        return NextResponse.json({
          status: "completed",
          generated_image_url: generatedImageUrl,
          request_id: requestId || null,
          org_id: orgId || null,
        });
      }
    }

    if (!requestId) {
      return NextResponse.json({ error: "Failed to enqueue try-on" }, { status: 500 });
    }

    return NextResponse.json({
      status: "processing",
      request_id: requestId,
      org_id: orgId || null,
    });
  } catch (error) {
    console.error("[tryon/auto] start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start auto try-on" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = toRequestId(req.nextUrl.searchParams);
  const orgId = normalizeText(req.nextUrl.searchParams.get("org_id"));

  if (!requestId) {
    return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "Missing FAL_KEY" }, { status: 500 });
  }

  fal.config({
    credentials: process.env.FAL_KEY,
  });

  try {
    const status = await getTryOnStatus(requestId);
    const statusStr = String(status.status);

    if (statusStr === "COMPLETED") {
      const result = await getTryOnResult(requestId);
      const generatedImageUrl = result.images[0]?.url || "";
      return NextResponse.json({
        status: "completed",
        generated_image_url: generatedImageUrl,
        request_id: requestId,
        org_id: orgId || null,
      });
    }

    if (statusStr === "FAILED") {
      return NextResponse.json({ status: "failed", request_id: requestId, org_id: orgId || null });
    }

    return NextResponse.json({
      status: statusStr === "IN_PROGRESS" ? "processing" : "queued",
      request_id: requestId,
      org_id: orgId || null,
    });
  } catch (error) {
    console.error("[tryon/auto] status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get auto try-on status" },
      { status: 500 }
    );
  }
}

