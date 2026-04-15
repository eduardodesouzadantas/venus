import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizePrivacyLogEntry } from "@/lib/privacy/logging";
import { recordOperationalTenantEvent } from "@/lib/reliability/observability";

type RateLimitWindow = {
  hits: number[];
};

function getStore(): Map<string, RateLimitWindow> {
  const globalScope = globalThis as typeof globalThis & {
    __venus_rate_limit_store__?: Map<string, RateLimitWindow>;
  };

  if (!globalScope.__venus_rate_limit_store__) {
    globalScope.__venus_rate_limit_store__ = new Map<string, RateLimitWindow>();
  }

  return globalScope.__venus_rate_limit_store__ as Map<string, RateLimitWindow>;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export interface SecurityRateLimitInput {
  scope: string;
  request: Request;
  limit: number;
  windowMs: number;
  keyParts?: Array<string | number | boolean | null | undefined>;
  nowMs?: number;
}

export interface SecurityRateLimitDecision {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number | null;
}

export interface SecurityAlertInput {
  orgId?: string | null;
  orgSlug?: string | null;
  eventType: string;
  eventSource?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}

function getRequestIp(request: Request) {
  const forwardedFor = normalizeText(request.headers.get("x-forwarded-for"));
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",").map((value) => value.trim()).filter(Boolean);
    if (firstIp) return firstIp;
  }

  return (
    normalizeText(request.headers.get("x-real-ip")) ||
    normalizeText(request.headers.get("cf-connecting-ip")) ||
    "unknown"
  );
}

function buildRateLimitKey(input: SecurityRateLimitInput) {
  const requestIp = getRequestIp(input.request);
  const keyParts = [
    input.scope,
    requestIp,
    ...(input.keyParts || []).map((value) => normalizeText(value)),
  ];
  return sha256Hex(keyParts.filter(Boolean).join("|") || input.scope || "global");
}

export function clearInMemoryRateLimitState() {
  getStore().clear();
}

export function checkInMemoryRateLimit(input: SecurityRateLimitInput): SecurityRateLimitDecision {
  const limit = Number.isFinite(input.limit) && input.limit > 0 ? Math.floor(input.limit) : 1;
  const windowMs = Number.isFinite(input.windowMs) && input.windowMs > 0 ? Math.floor(input.windowMs) : 60_000;
  const nowMs = Number.isFinite(input.nowMs) ? Math.floor(input.nowMs as number) : Date.now();
  const key = buildRateLimitKey(input);
  const store = getStore();
  const window = store.get(key) || { hits: [] };
  const nextHits = window.hits.filter((timestamp) => nowMs - timestamp < windowMs);

  if (nextHits.length >= limit) {
    const oldestHit = nextHits[0] || nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + windowMs - nowMs) / 1000));
    store.set(key, { hits: nextHits });

    return {
      allowed: false,
      key,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  nextHits.push(nowMs);
  store.set(key, { hits: nextHits });

  return {
    allowed: true,
    key,
    limit,
    remaining: Math.max(0, limit - nextHits.length),
    retryAfterSeconds: null,
  };
}

export function logSecurityEvent(level: "info" | "warn" | "error", event: string, details: Record<string, unknown>) {
  const payload = sanitizePrivacyLogEntry({
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });

  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer("[SECURITY]", payload);
}

export async function recordSecurityAlert(
  supabase: SupabaseClient,
  input: SecurityAlertInput
) {
  const orgId = normalizeText(input.orgId);
  const eventType = normalizeText(input.eventType);
  if (!orgId || !eventType) {
    return false;
  }

  return recordOperationalTenantEvent(supabase, {
    orgId,
    eventSource: input.eventSource || "security",
    eventType,
    payload: {
      org_id: orgId,
      org_slug: input.orgSlug || null,
      summary: input.summary,
      ...sanitizePrivacyLogEntry(input.details || {}),
    },
  });
}
