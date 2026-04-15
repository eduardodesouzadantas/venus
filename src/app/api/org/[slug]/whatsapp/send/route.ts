import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import {
  checkInMemoryRateLimit,
  logSecurityEvent,
  recordSecurityAlert,
} from "@/lib/reliability/security";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReturnTo(value: unknown, fallback: string) {
  const raw = normalize(value);
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : fallback;
}

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    return {
      to: normalize(body?.to),
      text: normalize(body?.text),
      returnTo: normalize(body?.return_to ?? body?.returnTo),
      isForm: false,
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { to: "", text: "", returnTo: "", isForm: true };
  }

  return {
    to: normalize(formData.get("to")),
    text: normalize(formData.get("text")),
    returnTo: normalize(formData.get("return_to")),
    isForm: true,
  };
}

function responseForFormError(request: Request, fallbackPath: string, message: string) {
  const target = new URL(normalizeReturnTo(fallbackPath, "/"), request.url);
  target.searchParams.set("action_error", message);
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const accessCheck = await resolveMerchantOrgAccess(slug).catch((error: unknown) => ({ error }));
  if ("error" in accessCheck) {
    const message = accessCheck.error instanceof Error ? accessCheck.error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }

  const { to, text, returnTo, isForm } = await readPayload(request);
  const dashboardPath = `/org/${slug}/dashboard`;
  const returnPath = normalizeReturnTo(returnTo, dashboardPath);

  if (!to || !text) {
    return isForm
      ? responseForFormError(request, returnPath, "Missing recipient or text")
      : NextResponse.json({ error: "Missing recipient or text" }, { status: 400 });
  }

  const accessToken = normalize(process.env.WHATSAPP_TOKEN);
  const phoneNumberId = normalize(process.env.WHATSAPP_PHONE_ID);

  if (!accessToken || !phoneNumberId) {
    return isForm
      ? responseForFormError(request, returnPath, "WhatsApp token or phone id missing")
      : NextResponse.json({ error: "WhatsApp token or phone id missing" }, { status: 500 });
  }

  const rateLimit = checkInMemoryRateLimit({
    scope: "whatsapp_send",
    request,
    limit: 12,
    windowMs: 10 * 60 * 1000,
    keyParts: [slug, to],
  });

  if (!rateLimit.allowed) {
    logSecurityEvent("warn", "rate_limit_exceeded", {
      route: "org/whatsapp/send",
      orgSlug: slug,
      recipient: to,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
    });

    await recordSecurityAlert(createAdminClient(), {
      orgId: accessCheck.org.id,
      orgSlug: slug,
      eventType: "security.rate_limited",
      summary: "WhatsApp send rate limit exceeded",
      details: {
        route: "org/whatsapp/send",
        recipient_masked: to.slice(-4),
        retry_after_seconds: rateLimit.retryAfterSeconds,
        limit: rateLimit.limit,
      },
    }).catch(() => null);

    return isForm
      ? responseForFormError(request, returnPath, "Muitas mensagens em pouco tempo. Aguarde um instante.")
      : NextResponse.json({ error: "rate_limited", retry_after_seconds: rateLimit.retryAfterSeconds }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: conversation, error: conversationError } = await admin
    .from("whatsapp_conversations")
    .select("id, org_slug, user_phone, user_name, last_message, last_updated, status, priority, unread_count")
    .eq("org_slug", slug)
    .eq("user_phone", to)
    .maybeSingle();

  if (conversationError || !conversation) {
    return isForm
      ? responseForFormError(request, returnPath, "Conversation not found")
      : NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Meta API error (${response.status})`;
    logSecurityEvent("warn", "whatsapp_meta_send_failed", {
      route: "org/whatsapp/send",
      orgSlug: slug,
      recipient: to,
      status: response.status,
    });
    return isForm
      ? responseForFormError(request, returnPath, message)
      : NextResponse.json({ error: message }, { status: 502 });
  }

  const metaMessageId = payload?.messages?.[0]?.id || null;

  const { data: messageRow, error: messageError } = await admin
    .from("whatsapp_messages")
    .insert({
      org_slug: slug,
      conversation_id: conversation.id,
      sender: "merchant",
      text,
      type: "text",
      metadata: {
        meta_message_id: metaMessageId,
        meta_phone_number_id: phoneNumberId,
      },
    })
    .select("id, created_at")
    .single();

  if (messageError || !messageRow) {
    const message = messageError?.message || "Failed to persist message";
    logSecurityEvent("error", "whatsapp_message_persist_failed", {
      route: "org/whatsapp/send",
      orgSlug: slug,
      recipient: to,
      error: message,
    });
    return isForm
      ? responseForFormError(request, returnPath, message)
      : NextResponse.json({ error: message }, { status: 500 });
  }

  await admin
    .from("whatsapp_conversations")
    .update({
      last_message: text,
      last_updated: new Date().toISOString(),
      status: "human_takeover",
      priority: "medium",
      unread_count: 0,
    })
    .eq("id", conversation.id)
    .eq("org_slug", slug);

  if (isForm) {
    return NextResponse.redirect(new URL(returnPath, request.url), { status: 303 });
  }

  return NextResponse.json(
    {
      ok: true,
      message_id: messageRow.id,
      meta_message_id: metaMessageId,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
