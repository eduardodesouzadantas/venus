import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  canAccessGamificationPanel,
  createGamificationRule,
  consumeGamificationBenefit,
  grantGamificationBenefit,
  loadGamificationOverview,
  normalizeGamificationBenefitResourceType,
  normalizeGamificationRuleType,
  normalizeGamificationTriggerEventType,
  updateGamificationRule,
} from "@/lib/gamification";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: unknown) {
  const raw = normalize(value).toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

function parsePositiveNumber(value: unknown, fallback: number) {
  const raw = normalize(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function parseOptionalPositiveNumber(value: unknown) {
  const raw = normalize(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.trunc(parsed);
}

function parseOptionalDate(value: unknown) {
  const raw = normalize(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseTriggerMode(value: unknown) {
  return normalize(value) === "automatic" ? "automatic" : "manual";
}

function buildRedirectUrl(requestUrl: string, redirectTo: string, params: Record<string, string>) {
  const url = new URL(redirectTo, requestUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  try {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function responseError(request: NextRequest, orgSlug: string, message: string, status = 400) {
  const acceptsJson = (request.headers.get("accept") || "").includes("application/json");
  if (acceptsJson) {
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.redirect(
    new URL(`/org/${encodeURIComponent(orgSlug)}/gamification?error=${encodeURIComponent(message)}`, request.url),
    303
  );
}

function responseSuccess(request: NextRequest, redirectTo: string, params: Record<string, string>) {
  const acceptsJson = (request.headers.get("accept") || "").includes("application/json");
  if (acceptsJson) {
    return NextResponse.json({ ok: true, ...params });
  }

  return NextResponse.redirect(buildRedirectUrl(request.url, redirectTo, params), 303);
}

async function handleMutation(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  if (process.env.GAMIFICATION_BUDGET_AWARE_ENABLED === "false") {
    return responseError(request, slug, "Gamification disabled", 403);
  }

  try {
    const access = await resolveMerchantOrgAccess(slug);
    if (!canAccessGamificationPanel(access.role)) {
      return responseError(request, slug, "Unauthorized", 403);
    }

    const payload = await readPayload(request);
    const intent = normalize(payload.intent);
    const redirectTo = normalize(payload.redirect_to) || `/org/${slug}/gamification`;
    const reason = normalize(payload.reason) || null;

    if (intent === "create_rule") {
      const triggerMode = parseTriggerMode(payload.trigger_mode);
      const triggerEventType = triggerMode === "automatic" ? normalizeGamificationTriggerEventType(payload.trigger_event_type) : null;
      if (triggerMode === "automatic" && !triggerEventType) {
        return responseError(request, slug, "Missing trigger_event_type", 400);
      }

      const rule = await createGamificationRule({
        orgId: access.org.id,
        actorUserId: access.user.id,
        reason,
        ruleType: normalizeGamificationRuleType(payload.rule_type) || "share_bonus",
        triggerMode,
        triggerEventType,
        benefitResourceType: normalizeGamificationBenefitResourceType(payload.benefit_resource_type) || "try_on",
        benefitAmount: parsePositiveNumber(payload.benefit_amount, 1),
        perCustomerLimit: parsePositiveNumber(payload.per_customer_limit, 1),
        perCustomerPeriodDays: parsePositiveNumber(payload.per_customer_period_days, 30),
        active: parseBoolean(payload.active),
        label: normalize(payload.label),
        description: normalize(payload.description) || null,
        validFrom: parseOptionalDate(payload.valid_from),
        validUntil: parseOptionalDate(payload.valid_until),
      });

      revalidatePath(`/org/${slug}/gamification`);
      revalidatePath(`/org/${slug}/dashboard`);
      return responseSuccess(request, redirectTo, { saved: "1", rule_id: rule.id });
    }

    if (intent === "update_rule") {
      const triggerMode = parseTriggerMode(payload.trigger_mode);
      const triggerEventType = triggerMode === "automatic" ? normalizeGamificationTriggerEventType(payload.trigger_event_type) : null;
      if (triggerMode === "automatic" && !triggerEventType) {
        return responseError(request, slug, "Missing trigger_event_type", 400);
      }

      const rule = await updateGamificationRule({
        orgId: access.org.id,
        actorUserId: access.user.id,
        reason,
        ruleId: normalize(payload.rule_id),
        ruleType: normalizeGamificationRuleType(payload.rule_type) || "share_bonus",
        triggerMode,
        triggerEventType,
        benefitResourceType: normalizeGamificationBenefitResourceType(payload.benefit_resource_type) || "try_on",
        benefitAmount: parsePositiveNumber(payload.benefit_amount, 1),
        perCustomerLimit: parsePositiveNumber(payload.per_customer_limit, 1),
        perCustomerPeriodDays: parsePositiveNumber(payload.per_customer_period_days, 30),
        active: parseBoolean(payload.active),
        label: normalize(payload.label),
        description: normalize(payload.description) || null,
        validFrom: parseOptionalDate(payload.valid_from),
        validUntil: parseOptionalDate(payload.valid_until),
      });

      revalidatePath(`/org/${slug}/gamification`);
      revalidatePath(`/org/${slug}/dashboard`);
      return responseSuccess(request, redirectTo, { saved: "1", rule_id: rule.id });
    }

    if (intent === "grant_benefit") {
      const result = await grantGamificationBenefit({
        orgId: access.org.id,
        actorUserId: access.user.id,
        customerKey: normalize(payload.customer_key),
        customerLabel: normalize(payload.customer_label) || null,
        ruleId: normalize(payload.rule_id),
        amount: parseOptionalPositiveNumber(payload.amount),
        reason,
      });

      if (!result.granted) {
        return responseError(request, slug, result.reason || "Grant blocked", 409);
      }

      revalidatePath(`/org/${slug}/gamification`);
      revalidatePath(`/org/${slug}/dashboard`);
      return responseSuccess(request, redirectTo, { saved: "1", customer_key: normalize(payload.customer_key) });
    }

    if (intent === "consume_benefit") {
      const result = await consumeGamificationBenefit({
        orgId: access.org.id,
        actorUserId: access.user.id,
        customerKey: normalize(payload.customer_key),
        customerLabel: normalize(payload.customer_label) || null,
        resourceType: normalizeGamificationBenefitResourceType(payload.resource_type) || "try_on",
        amount: parsePositiveNumber(payload.amount, 1),
        reason,
      });

      if (!result.consumed) {
        return responseError(request, slug, result.reason || "Consumption blocked", 409);
      }

      revalidatePath(`/org/${slug}/gamification`);
      revalidatePath(`/org/${slug}/dashboard`);
      return responseSuccess(request, redirectTo, { saved: "1", customer_key: normalize(payload.customer_key) });
    }

    return responseError(request, slug, "Invalid intent", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gamification update failed";
    if (message === "Unauthorized" || message === "Forbidden" || message === "Org not found") {
      return responseError(request, slug, message, 403);
    }

    return responseError(request, slug, message, 400);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  if (process.env.GAMIFICATION_BUDGET_AWARE_ENABLED === "false") {
    return NextResponse.json({ error: "Gamification disabled" }, { status: 403 });
  }

  try {
    const access = await resolveMerchantOrgAccess(slug);
    if (!canAccessGamificationPanel(access.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const overview = await loadGamificationOverview(access.org.id);
    return NextResponse.json({ ok: true, overview }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load gamification";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleMutation(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleMutation(request, context);
}
