import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

function normalizePart(value: unknown) {
  const raw =
    typeof value === "string"
      ? value.trim()
      : value === null || value === undefined
        ? ""
        : String(value).trim();

  return raw.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9:_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export type OperationalReasonScope =
  | "hard_cap"
  | "tenant_blocked"
  | "conflict"
  | "single_flight"
  | "lead_update"
  | "persist_result";

export function formatOperationalReason(scope: OperationalReasonScope, reason: string) {
  const normalizedScope = normalizePart(scope) || "operational";
  const normalizedReason = normalizePart(reason) || "unknown";
  return `${normalizedScope}:${normalizedReason}`;
}

export function createOperationalEventDedupeKey(parts: Array<string | number | boolean | null | undefined>) {
  const normalized = parts.map(normalizePart).filter(Boolean).join("|");
  return `op:${sha256Hex(normalized)}`;
}

export function captureOperationalTiming(startedAtMs: number, completedAtMs = Date.now()) {
  const safeStartedAt = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
  const safeCompletedAt = Number.isFinite(completedAtMs) ? completedAtMs : Date.now();
  const durationMs = Math.max(0, safeCompletedAt - safeStartedAt);

  return {
    started_at: new Date(safeStartedAt).toISOString(),
    completed_at: new Date(safeCompletedAt).toISOString(),
    duration_ms: durationMs,
  };
}

export interface OperationalTenantEventInput {
  orgId: string;
  eventType: string;
  eventSource?: string | null;
  actorUserId?: string | null;
  dedupeKey?: string | null;
  dedupeKeyParts?: Array<string | number | boolean | null | undefined>;
  payload?: Record<string, unknown>;
}

export async function recordOperationalTenantEvent(
  supabase: SupabaseClient,
  input: OperationalTenantEventInput
) {
  const orgId = normalizeText(input.orgId);
  const eventType = normalizeText(input.eventType);

  if (!orgId || !eventType) {
    return false;
  }

  const dedupeKey =
    normalizePart(input.dedupeKey) ||
    createOperationalEventDedupeKey([
      eventType,
      orgId,
      ...(input.dedupeKeyParts || []),
    ]);

  const { error } = await supabase.from("tenant_events").insert({
    org_id: orgId,
    actor_user_id: normalizeText(input.actorUserId) || null,
    event_type: eventType,
    event_source: normalizeText(input.eventSource) || "system",
    dedupe_key: dedupeKey,
    payload: input.payload || {},
  });

  if (error) {
    console.warn("[OBSERVABILITY] failed to record tenant event", {
      orgId,
      eventType,
      error: error.message,
    });
    return false;
  }

  return true;
}
