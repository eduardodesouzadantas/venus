import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { getTryOnResult, getTryOnStatus } from "@/lib/tryon/client";
import {
  checkInMemoryRateLimit,
  logSecurityEvent,
  recordSecurityAlert,
} from "@/lib/reliability/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TryOnAutoBody = {
  personImageUrl?: string;
  garmentImageUrl?: string;
  orgId?: string;
  category?: string;
  person_image_url?: string;
  garment_image_url?: string;
  org_id?: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function detectCategory(value: string): "tops" | "bottoms" | "one-pieces" {
  const text = normalizeText(value).toLowerCase();
  if (text.includes("dress") || text.includes("vestido")) return "one-pieces";
  if (text.includes("calca") || text.includes("calça") || text.includes("saia") || text.includes("pants") || text.includes("skirt")) return "bottoms";
  return "tops";
}

function buildTryOnInput(personImageUrl: string, garmentImageUrl: string, category: string) {
  return {
    model_image: personImageUrl,
    garment_image: garmentImageUrl,
    category: detectCategory(category),
  };
}

function isHttpsImageUrl(value: string) {
  return /^https:\/\/[^\s]+$/i.test(value);
}

function toRequestId(params: URLSearchParams) {
  return params.get("request_id") || params.get("requestId") || params.get("id") || "";
}

export async function POST(req: NextRequest) {
  let body: TryOnAutoBody;

  try {
    body = (await req.json()) as TryOnAutoBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const personImageUrl = normalizeText(body.personImageUrl || body.person_image_url);
  const garmentImageUrl = normalizeText(body.garmentImageUrl || body.garment_image_url);
  const orgId = normalizeText(body.orgId || body.org_id);
  const category = normalizeText(body.category) || "tops";

  console.info("[tryon/auto] request start", {
    orgId: orgId || null,
    hasPersonImage: Boolean(personImageUrl),
    hasGarmentImage: Boolean(garmentImageUrl),
    category,
  });

  if (!personImageUrl || !garmentImageUrl) {
    logSecurityEvent("warn", "tryon_missing_images", {
      route: "tryon/auto",
      orgId: orgId || null,
      hasPersonImage: !!personImageUrl,
      hasGarmentImage: !!garmentImageUrl,
    });
    return NextResponse.json({ error: "Missing required fields: person_image_url, garment_image_url" }, { status: 400 });
  }

  if (!isHttpsImageUrl(personImageUrl) || !isHttpsImageUrl(garmentImageUrl)) {
    logSecurityEvent("warn", "tryon_invalid_image_url", {
      route: "tryon/auto",
      orgId: orgId || null,
      hasPersonImage: isHttpsImageUrl(personImageUrl),
      hasGarmentImage: isHttpsImageUrl(garmentImageUrl),
    });
    return NextResponse.json({ error: "Invalid image url" }, { status: 400 });
  }

  const rateLimit = checkInMemoryRateLimit({
    scope: "tryon_auto",
    request: req,
    limit: 8,
    windowMs: 10 * 60 * 1000,
    keyParts: [orgId || "global"],
  });

  if (!rateLimit.allowed) {
    logSecurityEvent("warn", "rate_limit_exceeded", {
      route: "tryon/auto",
      orgId: orgId || null,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
    });

    if (orgId) {
      await recordSecurityAlert(createAdminClient(), {
        orgId,
        orgSlug: null,
        eventType: "security.rate_limited",
        summary: "Try-on auto rate limit exceeded",
        details: {
          route: "tryon/auto",
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

  if (!process.env.FAL_KEY) {
    console.warn("[tryon/auto] missing FAL_KEY", { orgId: orgId || null });
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
        console.info("[tryon/auto] provider enqueued", {
          orgId: orgId || null,
          requestId,
        });
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

      logSecurityEvent("info", "tryon_result_received", {
        route: "tryon/auto",
        orgId: orgId || null,
        hasImages: !!generatedImageUrl,
        requestId: requestId || null,
      });

      if (generatedImageUrl) {
        console.info("[tryon/auto] provider completed synchronously", {
          orgId: orgId || null,
          requestId: requestId || null,
          hasImage: true,
        });
        return NextResponse.json({
          status: "completed",
          generatedImageUrl,
          requestId: requestId || null,
          orgId: orgId || null,
        });
      }
    }

    if (!requestId) {
      console.warn("[tryon/auto] provider returned no requestId", { orgId: orgId || null });
      return NextResponse.json({ error: "Failed to enqueue try-on" }, { status: 500 });
    }

    console.info("[tryon/auto] provider processing", {
      orgId: orgId || null,
      requestId,
    });
    return NextResponse.json({
      status: "processing",
      requestId,
      orgId: orgId || null,
    });
  } catch (error) {
    logSecurityEvent("error", "tryon_start_failed", {
      route: "tryon/auto",
      orgId: orgId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start auto try-on" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = toRequestId(req.nextUrl.searchParams);
  const orgId = normalizeText(req.nextUrl.searchParams.get("orgId") || req.nextUrl.searchParams.get("org_id"));

  if (!requestId) {
    return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
  }

  if (!process.env.FAL_KEY) {
    console.warn("[tryon/auto] missing FAL_KEY during status poll", { orgId: orgId || null, requestId });
    return NextResponse.json({ error: "Missing FAL_KEY" }, { status: 500 });
  }

  const rateLimit = checkInMemoryRateLimit({
    scope: "tryon_auto_status",
    request: req,
    limit: 30,
    windowMs: 60 * 1000,
    keyParts: [orgId || "global"],
  });

  if (!rateLimit.allowed) {
    logSecurityEvent("warn", "rate_limit_exceeded", {
      route: "tryon/auto/status",
      orgId: orgId || null,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
    });
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: rateLimit.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds || 60) },
      }
    );
  }

  fal.config({
    credentials: process.env.FAL_KEY,
  });

  try {
    const status = await getTryOnStatus(requestId);
    const statusStr = String(status.status);
    console.info("[tryon/auto] status poll", {
      orgId: orgId || null,
      requestId,
      status: statusStr,
    });

    if (statusStr === "COMPLETED") {
      const result = await getTryOnResult(requestId);
      const generatedImageUrl = result.images[0]?.url || "";
      console.info("[tryon/auto] status completed", {
        orgId: orgId || null,
        requestId,
        hasImage: Boolean(generatedImageUrl),
      });
      return NextResponse.json({
        status: "completed",
        generatedImageUrl,
        requestId,
        orgId: orgId || null,
      });
    }

    if (statusStr === "FAILED") {
      console.warn("[tryon/auto] status failed", {
        orgId: orgId || null,
        requestId,
      });
      return NextResponse.json({ status: "failed", requestId, orgId: orgId || null });
    }

    return NextResponse.json({
      status: statusStr === "IN_PROGRESS" ? "processing" : "queued",
      requestId,
      orgId: orgId || null,
    });
  } catch (error) {
    logSecurityEvent("error", "tryon_status_failed", {
      route: "tryon/auto/status",
      orgId: orgId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get auto try-on status" },
      { status: 500 }
    );
  }
}
