import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { submitTryOn } from "@/lib/tryon/client";
import {
  checkInMemoryRateLimit,
  logSecurityEvent,
  recordSecurityAlert,
} from "@/lib/reliability/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { model_image?: string; product_id?: string; org_id?: string; saved_result_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { model_image, product_id, org_id, saved_result_id } = body;

  if (!model_image || !product_id || !org_id) {
    return NextResponse.json({ error: "Missing required fields: model_image, product_id, org_id" }, { status: 400 });
  }

  // Validar que o usuário pertence à org — nunca confiar no org_id do cliente
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", org_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden: not a member of this org" }, { status: 403 });
  }

  const rateLimit = checkInMemoryRateLimit({
    scope: "tryon_start",
    request: req,
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyParts: [org_id, user.id],
  });

  if (!rateLimit.allowed) {
    logSecurityEvent("warn", "rate_limit_exceeded", {
      route: "tryon/start",
      orgId: org_id,
      userId: user.id,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
    });

    await recordSecurityAlert(createAdminClient(), {
      orgId: org_id,
      orgSlug: null,
      eventType: "security.rate_limited",
      summary: "Try-on start rate limit exceeded",
      details: {
        route: "tryon/start",
        user_id: user.id,
        retry_after_seconds: rateLimit.retryAfterSeconds,
        limit: rateLimit.limit,
      },
    }).catch(() => null);

    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: rateLimit.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds || 60) },
      }
    );
  }

  // Verificar produto pertence à org
  const { data: product } = await supabase
    .from("products")
    .select("id, image_url")
    .eq("id", product_id)
    .eq("org_id", org_id)
    .maybeSingle();

  if (!product || !product.image_url) {
    return NextResponse.json({ error: "Product not found or missing image" }, { status: 404 });
  }

  // Verificar limite mensal (freemium = sem cap)
  const { data: org } = await supabase
    .from("orgs")
    .select("plan_id, limits")
    .eq("id", org_id)
    .single();

  const isFreemium = org?.plan_id === "freemium";

  if (!isFreemium) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("tryon_events")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org_id)
      .gte("created_at", startOfMonth.toISOString());

    const limits = org?.limits as Record<string, unknown> | null;
    const monthlyLimit = typeof limits?.tryon_monthly === "number" ? limits.tryon_monthly : 50;

    if ((count ?? 0) >= monthlyLimit) {
      return NextResponse.json(
        { error: "monthly_limit_reached", limit: monthlyLimit },
        { status: 429 }
      );
    }
  }

  try {
    const requestId = await submitTryOn({
      model_image,
      garment_image: product.image_url,
    });

    await supabase.from("tryon_events").insert({
      org_id,
      product_id,
      user_id: user.id,
      fal_request_id: requestId,
      status: "pending",
      saved_result_id: saved_result_id || null,
    });

    return NextResponse.json({ request_id: requestId });
  } catch (error) {
    logSecurityEvent("error", "tryon_start_failed", {
      route: "tryon/start",
      orgId: org_id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to start try-on" }, { status: 500 });
  }
}
