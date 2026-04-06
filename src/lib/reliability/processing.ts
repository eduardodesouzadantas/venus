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

interface ProcessingReservationRpcRow {
  reservation_key?: string | null;
  status?: ProcessingReservationStatus | string | null;
  saved_result_id?: string | null;
  owner_token?: string | null;
  expires_at?: string | null;
  error_message?: string | null;
  acquired?: boolean | null;
  should_wait?: boolean | null;
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

function parseProcessingReservationRow(row: ProcessingReservationRpcRow | null | undefined): ProcessingReservationOutcome | null {
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
    acquired: Boolean(row.acquired),
    should_wait: Boolean(row.should_wait),
  };
}

async function rpcProcessingReservation(
  supabase: SupabaseClient,
  rpcName: "reserve_saved_result_processing" | "complete_saved_result_processing" | "fail_saved_result_processing",
  input: Record<string, unknown>
) {
  const { data, error } = await supabase.schema("tenant").rpc(rpcName, input);

  if (error) {
    throw new Error(error.message || `Failed to execute ${rpcName}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return parseProcessingReservationRow((row as ProcessingReservationRpcRow | null | undefined) || null);
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
  const outcome = await rpcProcessingReservation(supabase, "reserve_saved_result_processing", {
    p_org_id: normalizeString(input.orgId),
    p_reservation_key: normalizeString(input.reservationKey),
    p_owner_token: normalizeString(input.ownerToken),
    p_ttl_seconds: Number.isFinite(input.ttlSeconds ?? NaN) ? input.ttlSeconds : 900,
  });

  if (!outcome) {
    throw new Error("Failed to reserve processing");
  }

  return outcome;
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
  const outcome = await rpcProcessingReservation(supabase, "complete_saved_result_processing", {
    p_org_id: normalizeString(input.orgId),
    p_reservation_key: normalizeString(input.reservationKey),
    p_owner_token: normalizeString(input.ownerToken),
    p_saved_result_id: normalizeString(input.savedResultId),
  });

  if (!outcome) {
    throw new Error("Failed to complete processing reservation");
  }

  return outcome;
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
  const outcome = await rpcProcessingReservation(supabase, "fail_saved_result_processing", {
    p_org_id: normalizeString(input.orgId),
    p_reservation_key: normalizeString(input.reservationKey),
    p_owner_token: normalizeString(input.ownerToken),
    p_error_message: normalizeString(input.errorMessage || null) || null,
  });

  if (!outcome) {
    throw new Error("Failed to fail processing reservation");
  }

  return outcome;
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
