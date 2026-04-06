import type { SupabaseClient } from "@supabase/supabase-js";
import { createLeadStateIdempotencyKey } from "@/lib/reliability/idempotency";
import {
  captureOperationalTiming,
  formatOperationalReason,
  recordOperationalTenantEvent,
} from "@/lib/reliability/observability";

export const LEAD_STATUSES = ["new", "engaged", "qualified", "offer_sent", "closing", "won", "lost"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export function createEmptyLeadStatusCounts(): Record<LeadStatus, number> {
  return LEAD_STATUSES.reduce((counts, status) => {
    counts[status] = 0;
    return counts;
  }, {} as Record<LeadStatus, number>);
}

export function getLeadStatusLabel(status: LeadStatus) {
  switch (status) {
    case "new":
      return "Novo";
    case "engaged":
      return "Engajado";
    case "qualified":
      return "Qualificado";
    case "offer_sent":
      return "Oferta enviada";
    case "closing":
      return "Fechamento iniciado";
    case "won":
      return "Ganho";
    case "lost":
      return "Perdido";
  }
}

export function getLeadStatusEventType(status: LeadStatus) {
  switch (status) {
    case "offer_sent":
      return "lead.offer_sent";
    case "closing":
      return "lead.closing_started";
    case "won":
      return "lead.closed_won";
    case "lost":
      return "lead.closed_lost";
    default:
      return "lead.status_updated";
  }
}

export interface LeadRecord {
  id: string;
  org_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  saved_result_id: string | null;
  intent_score: number | null;
  whatsapp_key: string | null;
  next_follow_up_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_interaction_at?: string | null;
}

export interface LeadUpsertInput {
  orgId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: LeadStatus;
  savedResultId?: string | null;
  intentScore?: number | null;
  whatsappKey?: string | null;
  lastInteractionAt?: string | null;
  nextFollowUpAt?: string | null;
}

export interface LeadSignals {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  intentScore?: number | null;
  whatsappKey?: string | null;
  lastInteractionAt?: string | null;
}

function normalizeString(value?: string | null) {
  return (value || "").trim();
}

function clampIntentScore(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

const LEAD_STATUS_RANK: Record<LeadStatus, number> = {
  new: 0,
  engaged: 1,
  qualified: 2,
  offer_sent: 3,
  closing: 4,
  won: 5,
  lost: 6,
};

function isLeadUpdateConflictError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.includes("Lead changed while editing") || message.includes("40001");
}

export function resolveLeadStatus(existingStatus: LeadStatus | null | undefined, nextStatus?: LeadStatus) {
  if (!nextStatus) {
    return existingStatus || "new";
  }

  if (!existingStatus) {
    return nextStatus;
  }

  const existingIsClosed = existingStatus === "won" || existingStatus === "lost";
  const nextIsClosed = nextStatus === "won" || nextStatus === "lost";

  if (existingIsClosed && existingStatus !== nextStatus) {
    return existingStatus;
  }

  if (existingIsClosed && nextIsClosed) {
    return existingStatus;
  }

  return LEAD_STATUS_RANK[nextStatus] >= LEAD_STATUS_RANK[existingStatus] ? nextStatus : existingStatus;
}

export function normalizeLeadPhone(value?: string | null) {
  return normalizeString(value).replace(/\D/g, "");
}

export function normalizeLeadEmail(value?: string | null) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized || "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function extractLeadSignalsFromSavedResultPayload(payload: unknown): LeadSignals {
  const record = asRecord(payload);
  const onboardingContext = asRecord(record.onboardingContext);
  const intent = asRecord(onboardingContext.intent);
  const contact = asRecord(onboardingContext.contact);
  const whatsappHandoff = asRecord(record.whatsappHandoff);

  const rawIntentScore =
    whatsappHandoff.intentScore ??
    intent.satisfaction ??
    intent.intentScore;

  const fromOnboardingPhone = normalizeLeadPhone(contact.phone as string | null | undefined);
  const fromHandoffPhone = normalizeLeadPhone(whatsappHandoff.contactPhone as string | null | undefined);
  const phone = fromHandoffPhone || fromOnboardingPhone || "";
  const email = normalizeLeadEmail((contact.email as string | null | undefined) || (record.user_email as string | null | undefined));
  const name =
    normalizeString((whatsappHandoff.contactName as string | null | undefined) || (contact.name as string | null | undefined) || (record.user_name as string | null | undefined)) ||
    null;

  return {
    name,
    email: email || null,
    phone: phone || null,
    intentScore: clampIntentScore(
      typeof rawIntentScore === "number"
        ? rawIntentScore
        : typeof rawIntentScore === "string"
          ? Number(rawIntentScore)
          : null
    ),
    whatsappKey: phone || null,
    lastInteractionAt:
      normalizeString(whatsappHandoff.createdAt as string | null | undefined) ||
      normalizeString(record.updated_at as string | null | undefined) ||
      normalizeString(record.created_at as string | null | undefined) ||
      null,
  };
}

export async function getLeadBySavedResult(supabase: SupabaseClient, orgId: string, savedResultId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", normalizeString(orgId))
    .eq("saved_result_id", normalizeString(savedResultId))
    .maybeSingle();

  if (error) {
    return { lead: null as LeadRecord | null, error };
  }

  return { lead: (data as LeadRecord | null) ?? null, error: null };
}

export async function getLeadByPhone(supabase: SupabaseClient, orgId: string, phone: string) {
  const normalizedPhone = normalizeLeadPhone(phone);
  if (!normalizedPhone) {
    return { lead: null as LeadRecord | null, error: null as Error | null };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", normalizeString(orgId))
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (error) {
    return { lead: null as LeadRecord | null, error };
  }

  return { lead: (data as LeadRecord | null) ?? null, error: null };
}

export async function getLeadByEmail(supabase: SupabaseClient, orgId: string, email: string) {
  const normalizedEmail = normalizeLeadEmail(email);
  if (!normalizedEmail) {
    return { lead: null as LeadRecord | null, error: null as Error | null };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", normalizeString(orgId))
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    return { lead: null as LeadRecord | null, error };
  }

  return { lead: (data as LeadRecord | null) ?? null, error: null };
}

export async function findOrCreateLead(supabase: SupabaseClient, input: LeadUpsertInput) {
  const orgId = normalizeString(input.orgId);
  if (!orgId) {
    throw new Error("Missing orgId");
  }

  const phone = normalizeLeadPhone(input.phone);
  const email = normalizeLeadEmail(input.email);
  const savedResultId = normalizeString(input.savedResultId);

  const savedResultLookup = savedResultId
    ? await getLeadBySavedResult(supabase, orgId, savedResultId)
    : { lead: null as LeadRecord | null, error: null as Error | null };

  if (savedResultLookup.error) {
    throw savedResultLookup.error;
  }

  const phoneLookup = !savedResultLookup.lead && phone
    ? await getLeadByPhone(supabase, orgId, phone)
    : { lead: null as LeadRecord | null, error: null as Error | null };

  if (phoneLookup.error) {
    throw phoneLookup.error;
  }

  const emailLookup = !savedResultLookup.lead && !phoneLookup.lead && email
    ? await getLeadByEmail(supabase, orgId, email)
    : { lead: null as LeadRecord | null, error: null as Error | null };

  if (emailLookup.error) {
    throw emailLookup.error;
  }

  const existingLead = savedResultLookup.lead || phoneLookup.lead || emailLookup.lead;
  const nextIntentScore = typeof input.intentScore === "number" && !Number.isNaN(input.intentScore)
    ? input.intentScore
    : null;
  const lastInteractionAt = input.lastInteractionAt || new Date().toISOString();

  if (existingLead) {
    const mergedIntentScore =
      nextIntentScore === null
        ? existingLead.intent_score
        : Math.max(Number(existingLead.intent_score || 0), nextIntentScore);

    const { data, error } = await supabase
      .from("leads")
      .update({
        name: input.name || existingLead.name,
        email: email || existingLead.email,
        phone: phone || existingLead.phone,
        source: input.source || existingLead.source,
        status: resolveLeadStatus(existingLead.status, input.status),
        saved_result_id: savedResultId || existingLead.saved_result_id,
        intent_score: mergedIntentScore,
        whatsapp_key: input.whatsappKey || phone || existingLead.whatsapp_key,
        updated_at: new Date().toISOString(),
        last_interaction_at: lastInteractionAt,
      })
      .eq("id", existingLead.id)
      .eq("org_id", orgId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to update lead");
    }

    return { lead: data as LeadRecord, created: false };
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id: orgId,
      name: normalizeString(input.name) || null,
      email: email || null,
      phone: phone || null,
      source: normalizeString(input.source) || null,
      status: input.status || "new",
      saved_result_id: savedResultId || null,
      intent_score: nextIntentScore,
      whatsapp_key: input.whatsappKey || phone || null,
      updated_at: lastInteractionAt,
      last_interaction_at: lastInteractionAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create lead");
  }

  return { lead: data as LeadRecord, created: true };
}

export async function listLeadsByOrg(supabase: SupabaseClient, orgId: string) {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) {
    return { leads: [] as LeadRecord[], error: null as Error | null };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", normalizedOrgId)
    .order("last_interaction_at", { ascending: false, nullsFirst: false });

  if (error) {
    return { leads: [] as LeadRecord[], error };
  }

  return { leads: (data as LeadRecord[]) || [], error: null };
}

export interface LeadStatusUpdateInput {
  orgId: string;
  leadId: string;
  status?: LeadStatus;
  nextFollowUpAt?: string | null;
  lastInteractionAt?: string | null;
  expectedUpdatedAt?: string | null;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  eventSource?: string | null;
}

export async function updateLeadOperationalState(supabase: SupabaseClient, input: LeadStatusUpdateInput) {
  const orgId = normalizeString(input.orgId);
  const leadId = normalizeString(input.leadId);
  if (!orgId || !leadId) {
    throw new Error("Missing lead identifiers");
  }

  const hasStatus = typeof input.status === "string" && input.status.length > 0;
  const hasFollowUp = Object.prototype.hasOwnProperty.call(input, "nextFollowUpAt");

  if (!hasStatus && !hasFollowUp) {
    throw new Error("Missing lead updates");
  }

  const startedAtMs = Date.now();
  const nextTimestamp = input.lastInteractionAt || new Date().toISOString();
  const idempotencyKey =
    normalizeString(input.idempotencyKey) ||
    createLeadStateIdempotencyKey({
      orgId,
      leadId,
      hasStatus,
      status: input.status || null,
      hasNextFollowUpAt: hasFollowUp,
      nextFollowUpAt: hasFollowUp ? input.nextFollowUpAt || null : null,
      expectedUpdatedAt: input.expectedUpdatedAt || null,
    });

  try {
    const { data, error } = await supabase.schema("tenant").rpc("apply_lead_state_change", {
      p_org_id: orgId,
      p_lead_id: leadId,
      p_has_status: hasStatus,
      p_status: input.status || null,
      p_has_next_follow_up_at: hasFollowUp,
      p_next_follow_up_at: hasFollowUp ? input.nextFollowUpAt || null : null,
      p_last_interaction_at: nextTimestamp,
      p_actor_user_id: input.actorUserId || null,
      p_event_source: input.eventSource || "agency",
      p_idempotency_key: idempotencyKey,
      p_expected_updated_at: input.expectedUpdatedAt || null,
    });

    if (error || !data) {
      throw new Error(error?.message || "Failed to update lead status");
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error("Failed to update lead status");
    }

    await recordOperationalTenantEvent(supabase, {
      orgId,
      actorUserId: input.actorUserId || null,
      eventSource: input.eventSource || "agency",
      eventType: "lead.update_succeeded",
      dedupeKeyParts: [
        orgId,
        leadId,
        idempotencyKey,
        input.status || "status_only",
        hasFollowUp ? input.nextFollowUpAt || "follow_up_null" : "no_follow_up",
      ],
      payload: {
        lead_id: leadId,
        org_id: orgId,
        status: (row as LeadRecord).status,
        next_follow_up_at: (row as LeadRecord).next_follow_up_at,
        updated_fields: {
          status: hasStatus,
          next_follow_up_at: hasFollowUp,
        },
        idempotency_key: idempotencyKey,
        expected_updated_at: input.expectedUpdatedAt || null,
        reason_code: formatOperationalReason("lead_update", "success"),
        ...captureOperationalTiming(startedAtMs),
      },
    });

    return { lead: row as LeadRecord };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lead status";
    const isConflict = isLeadUpdateConflictError(error);

    await recordOperationalTenantEvent(supabase, {
      orgId,
      actorUserId: input.actorUserId || null,
      eventSource: input.eventSource || "agency",
      eventType: isConflict ? "lead.update_conflict" : "lead.update_failed",
      dedupeKeyParts: [
        orgId,
        leadId,
        idempotencyKey,
        isConflict ? "conflict" : "failed",
        input.expectedUpdatedAt || "no_expected_updated_at",
      ],
      payload: {
        lead_id: leadId,
        org_id: orgId,
        idempotency_key: idempotencyKey,
        expected_updated_at: input.expectedUpdatedAt || null,
        error_message: message,
        reason_code: isConflict
          ? formatOperationalReason("conflict", "stale_snapshot")
          : formatOperationalReason("lead_update", "failed"),
        ...captureOperationalTiming(startedAtMs),
      },
    });

    throw new Error(message);
  }
}

export interface PersistSavedResultLeadInput {
  orgId: string;
  idempotencyKey?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  payload: Record<string, unknown>;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  leadSource?: string | null;
  leadStatus?: LeadStatus;
  intentScore?: number | null;
  whatsappKey?: string | null;
  lastInteractionAt?: string | null;
  eventSource?: string | null;
}

export interface PersistSavedResultLeadResult {
  savedResultId: string;
  leadId: string;
  savedResultCreated: boolean;
  leadCreated: boolean;
}

interface PersistSavedResultLeadRpcRow {
  saved_result_id?: string | null;
  lead_id?: string | null;
  saved_result_created?: boolean | null;
  lead_created?: boolean | null;
}

export async function persistSavedResultAndLead(supabase: SupabaseClient, input: PersistSavedResultLeadInput) {
  const orgId = normalizeString(input.orgId);
  if (!orgId) {
    throw new Error("Missing orgId");
  }

  const idempotencyKey = normalizeString(input.idempotencyKey);
  if (!idempotencyKey) {
    throw new Error("Missing saved result idempotency key");
  }

  const { data, error } = await supabase.schema("tenant").rpc("persist_saved_result_and_lead", {
    p_org_id: orgId,
    p_idempotency_key: idempotencyKey,
    p_user_email: normalizeLeadEmail(input.userEmail || null) || null,
    p_user_name: normalizeString(input.userName) || null,
    p_payload: input.payload,
    p_lead_name: normalizeString(input.leadName) || null,
    p_lead_email: normalizeLeadEmail(input.leadEmail || null) || null,
    p_lead_phone: normalizeLeadPhone(input.leadPhone || null) || null,
    p_lead_source: normalizeString(input.leadSource) || "app",
    p_lead_status: input.leadStatus || "new",
    p_intent_score: typeof input.intentScore === "number" && !Number.isNaN(input.intentScore) ? input.intentScore : null,
    p_whatsapp_key: normalizeLeadPhone(input.whatsappKey || null) || null,
    p_last_interaction_at: input.lastInteractionAt || null,
    p_event_source: input.eventSource || "app",
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to persist saved result");
  }

  const row = Array.isArray(data) ? data[0] : data;
  const typedRow = (row || {}) as PersistSavedResultLeadRpcRow;
  const savedResultId = normalizeString(typedRow.saved_result_id);
  const leadId = normalizeString(typedRow.lead_id);

  if (!savedResultId || !leadId) {
    throw new Error("Failed to persist saved result and lead");
  }

  return {
    savedResultId,
    leadId,
    savedResultCreated: Boolean(typedRow.saved_result_created),
    leadCreated: Boolean(typedRow.lead_created),
  } satisfies PersistSavedResultLeadResult;
}

export async function updateLeadStatus(supabase: SupabaseClient, input: LeadStatusUpdateInput) {
  if (!input.status) {
    throw new Error("Missing lead status");
  }

  return updateLeadOperationalState(supabase, input);
}
