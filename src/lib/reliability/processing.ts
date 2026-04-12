import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProcessingReservationStatus = "in_progress" | "completed" | "failed";

export interface ProcessingReservationSnapshot {
  reservation_key: string;
  status: ProcessingReservationStatus;
  saved_result_id: string | null;
  owner_token: string | null;
  expires_at: string | null;
  error_message: string | null;
}

export interface ProcessingReservationOutcome extends ProcessingReservationSnapshot {
  acquired: boolean;
  should_wait: boolean;
}

interface ProcessingReservationRow {
  id?: string | null;
  org_id?: string | null;
  reservation_key?: string | null;
  status?: ProcessingReservationStatus | string | null;
  saved_result_id?: string | null;
  owner_token?: string | null;
  expires_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_claimed_at?: string | null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function createProcessingOwnerToken() {
  return randomUUID();
}

export function isProcessingReservationClaimable(snapshot: ProcessingReservationSnapshot, now = new Date(), ownerToken?: string | null) {
  if (snapshot.status === "completed" && snapshot.saved_result_id) {
    return false;
  }

  if (snapshot.status === "failed") {
    return true;
  }

  const expiresAt = snapshot.expires_at ? new Date(snapshot.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
    return true;
  }

  if (ownerToken && snapshot.owner_token && snapshot.owner_token === ownerToken) {
    return true;
  }

  return false;
}

export function shouldWaitOnProcessingReservation(snapshot: ProcessingReservationSnapshot, now = new Date()) {
  if (snapshot.status !== "in_progress") {
    return false;
  }

  const expiresAt = snapshot.expires_at ? new Date(snapshot.expires_at) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return true;
  }

  return expiresAt.getTime() > now.getTime();
}

function parseProcessingReservationRow(
  row: ProcessingReservationRow | null | undefined,
  acquired = false,
  should_wait = false
): ProcessingReservationOutcome | null {
  if (!row) {
    return null;
  }

  const reservationKey = normalizeString(row.reservation_key);
  const status = row.status === "completed" || row.status === "failed" ? row.status : "in_progress";

  if (!reservationKey) {
    return null;
  }

  return {
    reservation_key: reservationKey,
    status,
    saved_result_id: normalizeString(row.saved_result_id) || null,
    owner_token: normalizeString(row.owner_token) || null,
    expires_at: normalizeString(row.expires_at) || null,
    error_message: normalizeString(row.error_message) || null,
    acquired,
    should_wait,
  };
}

function normalizeTtlSeconds(value: unknown) {
  return Number.isFinite(Number(value)) ? Math.max(300, Math.min(3600, Number(value))) : 900;
}

function isReservationExpired(row: ProcessingReservationRow, now = new Date()) {
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return true;
  }

  return expiresAt.getTime() <= now.getTime();
}

async function loadProcessingReservation(supabase: SupabaseClient, orgId: string, reservationKey: string) {
  console.info("[PROCESSING_RESERVATION] lookup start", { orgId, reservationKey });
  const { data, error } = await supabase
    .from("tenant_processing_reservations")
    .select("*")
    .eq("org_id", orgId)
    .eq("reservation_key", reservationKey)
    .maybeSingle();

  if (error) {
    console.error("[PROCESSING_RESERVATION] lookup fail", { orgId, reservationKey, error });
    throw error;
  }

  console.info("[PROCESSING_RESERVATION] lookup success", {
    orgId,
    reservationKey,
    found: Boolean(data),
    status: (data as ProcessingReservationRow | null)?.status || null,
  });
  return (data as ProcessingReservationRow | null) ?? null;
}

async function persistProcessingReservation(
  supabase: SupabaseClient,
  row: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("tenant_processing_reservations")
    .upsert(row, { onConflict: "reservation_key" })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[PROCESSING_RESERVATION] table write fail", {
      row,
      error,
    });
    throw new Error(error?.message || "Failed to persist processing reservation");
  }

  console.info("[PROCESSING_RESERVATION] table write success", {
    orgId: data.org_id || row.org_id || null,
    reservationKey: data.reservation_key || row.reservation_key || null,
    status: data.status || null,
    savedResultId: data.saved_result_id || null,
  });
  return data as ProcessingReservationRow;
}

export async function reserveProcessingReservation(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    reservationKey: string;
    ownerToken: string;
    ttlSeconds?: number;
  }
) {
  const orgId = normalizeString(input.orgId);
  const reservationKey = normalizeString(input.reservationKey);
  const ownerToken = normalizeString(input.ownerToken);
  if (!orgId || !reservationKey || !ownerToken) {
    throw new Error("Missing processing reservation identifiers");
  }

  console.info("[PROCESSING_RESERVATION] reserve start", {
    orgId,
    reservationKey,
    ownerToken,
    ttlSeconds: normalizeTtlSeconds(input.ttlSeconds),
  });

  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds);
  const now = new Date();
  const existing = await loadProcessingReservation(supabase, orgId, reservationKey);
  console.info("[PROCESSING_RESERVATION] reserve loaded", {
    orgId,
    reservationKey,
    found: Boolean(existing),
    status: existing?.status || null,
    savedResultId: existing?.saved_result_id || null,
    expiresAt: existing?.expires_at || null,
  });

  if (existing) {
    if (existing.status === "completed" && existing.saved_result_id) {
      const completed = parseProcessingReservationRow(existing, false, false);
      if (!completed) {
        throw new Error("Failed to load processing reservation");
      }
      return completed;
    }

    if (existing.status === "in_progress" && !isReservationExpired(existing, now) && existing.owner_token && existing.owner_token !== ownerToken) {
      const busy = parseProcessingReservationRow(existing, false, true);
      if (!busy) {
        throw new Error("Failed to load processing reservation");
      }
      return busy;
    }
  }

  const updated = await persistProcessingReservation(supabase, {
    org_id: orgId,
    reservation_key: reservationKey,
    owner_token: ownerToken,
    status: "in_progress",
    saved_result_id: null,
    error_message: null,
    expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    updated_at: now.toISOString(),
    last_claimed_at: now.toISOString(),
  });

  const acquired = parseProcessingReservationRow(updated, true, false);
  if (!acquired) {
    throw new Error("Failed to load processing reservation");
  }
  console.info("[PROCESSING_RESERVATION] reserve acquired", {
    orgId,
    reservationKey,
    status: acquired.status,
    savedResultId: acquired.saved_result_id,
    expiresAt: acquired.expires_at,
  });
  return acquired;
}

export async function completeProcessingReservation(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    reservationKey: string;
    ownerToken: string;
    savedResultId: string;
  }
) {
  const orgId = normalizeString(input.orgId);
  const reservationKey = normalizeString(input.reservationKey);
  const ownerToken = normalizeString(input.ownerToken);
  const savedResultId = normalizeString(input.savedResultId);
  if (!orgId || !reservationKey || !ownerToken || !savedResultId) {
    throw new Error("Missing processing completion identifiers");
  }

  const now = new Date();
  const existing = await loadProcessingReservation(supabase, orgId, reservationKey);
  console.info("[PROCESSING_RESERVATION] complete loaded", {
    orgId,
    reservationKey,
    found: Boolean(existing),
    status: existing?.status || null,
    savedResultId: existing?.saved_result_id || null,
  });

  if (!existing) {
    throw new Error("Processing reservation not found");
  }

  if (existing.status === "completed" && existing.saved_result_id === savedResultId) {
    const completed = parseProcessingReservationRow(existing, false, false);
    if (!completed) {
      throw new Error("Failed to load processing reservation");
    }
    return completed;
  }

  if (existing.owner_token && existing.owner_token !== ownerToken && !isReservationExpired(existing, now)) {
    throw new Error("Processing reservation owner mismatch");
  }

  const updated = await persistProcessingReservation(supabase, {
    org_id: orgId,
    reservation_key: reservationKey,
    owner_token: ownerToken,
    status: "completed",
    saved_result_id: savedResultId,
    error_message: null,
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: now.toISOString(),
    last_claimed_at: now.toISOString(),
  });

  const completed = parseProcessingReservationRow(updated, true, false);
  if (!completed) {
    throw new Error("Failed to load processing reservation");
  }
  console.info("[PROCESSING_RESERVATION] complete ok", {
    orgId,
    reservationKey,
    savedResultId: completed.saved_result_id,
    status: completed.status,
  });
  return completed;
}

export async function failProcessingReservation(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    reservationKey: string;
    ownerToken: string;
    errorMessage?: string | null;
  }
) {
  const orgId = normalizeString(input.orgId);
  const reservationKey = normalizeString(input.reservationKey);
  const ownerToken = normalizeString(input.ownerToken);
  if (!orgId || !reservationKey || !ownerToken) {
    throw new Error("Missing processing failure identifiers");
  }

  const now = new Date();
  const existing = await loadProcessingReservation(supabase, orgId, reservationKey);
  console.info("[PROCESSING_RESERVATION] fail loaded", {
    orgId,
    reservationKey,
    found: Boolean(existing),
    status: existing?.status || null,
    savedResultId: existing?.saved_result_id || null,
  });

  if (!existing) {
    throw new Error("Processing reservation not found");
  }

  if (existing.status === "completed") {
    const completed = parseProcessingReservationRow(existing, false, false);
    if (!completed) {
      throw new Error("Failed to load processing reservation");
    }
    return completed;
  }

  if (existing.owner_token && existing.owner_token !== ownerToken && !isReservationExpired(existing, now)) {
    throw new Error("Processing reservation owner mismatch");
  }

  const updated = await persistProcessingReservation(supabase, {
    org_id: orgId,
    reservation_key: reservationKey,
    owner_token: ownerToken,
    status: "failed",
    saved_result_id: existing.saved_result_id || null,
    error_message: normalizeString(input.errorMessage || null) || null,
    expires_at: now.toISOString(),
    updated_at: now.toISOString(),
    last_claimed_at: now.toISOString(),
  });

  const failed = parseProcessingReservationRow(updated, true, false);
  if (!failed) {
    throw new Error("Failed to load processing reservation");
  }
  console.info("[PROCESSING_RESERVATION] fail ok", {
    orgId,
    reservationKey,
    status: failed.status,
    errorMessage: failed.error_message,
  });
  return failed;
}

export async function waitForProcessingReservation(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    reservationKey: string;
    ownerToken: string;
    ttlSeconds?: number;
    maxWaitMs?: number;
    pollIntervalMs?: number;
  }
) {
  const maxWaitMs = input.maxWaitMs ?? 45_000;
  const pollIntervalMs = input.pollIntervalMs ?? 1_000;
  const startedAt = Date.now();
  let lastOutcome: ProcessingReservationOutcome | null = null;

  while (Date.now() - startedAt <= maxWaitMs) {
    lastOutcome = await reserveProcessingReservation(supabase, {
      orgId: input.orgId,
      reservationKey: input.reservationKey,
      ownerToken: input.ownerToken,
      ttlSeconds: input.ttlSeconds,
    });

    if (lastOutcome.acquired || lastOutcome.status === "completed" || lastOutcome.status === "failed") {
      return lastOutcome;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return lastOutcome;
}
