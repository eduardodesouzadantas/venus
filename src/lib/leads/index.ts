import type { SupabaseClient } from "@supabase/supabase-js";
import { createLeadStateIdempotencyKey } from "@/lib/reliability/idempotency";
import {
  captureOperationalTiming,
  formatOperationalReason,
  recordOperationalTenantEvent,
} from "@/lib/reliability/observability";
import { bumpTenantUsageDaily } from "@/lib/tenant/core";

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
      return "Em conversa";
    case "qualified":
      return "Qualificado";
    case "offer_sent":
      return "Proposta enviada";
    case "closing":
      return "Fechamento em andamento";
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
  notes: string | null;
  owner_user_id: string | null;
  conversation_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_interaction_at?: string | null;
}

export interface LeadTimelineEvent {
  id: string;
  lead_id: string;
  org_id: string;
  actor_user_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export type LeadTimelineEventType =
  | "created"
  | "status_changed"
  | "note_added"
  | "assigned"
  | "conversation_linked"
  | "follow_up_scheduled"
  | "whatsapp_message";

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
  notes?: string | null;
  ownerUserId?: string | null;
  conversationId?: string | null;
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

export async function getLeadById(supabase: SupabaseClient, orgId: string, leadId: string) {
  const normalizedOrgId = normalizeString(orgId);
  const normalizedLeadId = normalizeString(leadId);
  if (!normalizedOrgId || !normalizedLeadId) {
    return { lead: null as LeadRecord | null, error: null as Error | null };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", normalizedOrgId)
    .eq("id", normalizedLeadId)
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
      console.error("[LEADS] update fail", {
        orgId,
        savedResultId,
        leadId: existingLead.id,
        error,
      });
      throw new Error(error?.message || "Failed to update lead");
    }

    console.info("[LEADS] update success", {
      orgId,
      savedResultId,
      leadId: existingLead.id,
    });

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
    console.error("[LEADS] insert fail", {
      orgId,
      savedResultId,
      error,
    });
    throw new Error(error?.message || "Failed to create lead");
  }

  console.info("[LEADS] insert success", {
    orgId,
    savedResultId,
    leadId: (data as LeadRecord).id,
  });

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
    console.info("[LEADS] updateLeadOperationalState start", {
      orgId,
      leadId,
      status: input.status || null,
      hasFollowUp,
      expectedUpdatedAt: input.expectedUpdatedAt || null,
    });

    const { lead: currentLead, error: lookupError } = await getLeadById(supabase, orgId, leadId);
    if (lookupError) {
      throw lookupError;
    }

    if (!currentLead) {
      throw new Error("Failed to update lead status");
    }

    console.info("[LEADS] updateLeadOperationalState lead loaded", {
      orgId,
      leadId,
      currentStatus: currentLead.status,
      currentUpdatedAt: currentLead.updated_at || null,
    });

    const nextStatus = resolveLeadStatus(currentLead.status, input.status);
    const nextFollowUpAt = hasFollowUp ? input.nextFollowUpAt || null : currentLead.next_follow_up_at;

    let updateQuery = supabase
      .from("leads")
      .update({
        name: currentLead.name,
        email: currentLead.email,
        phone: currentLead.phone,
        source: currentLead.source,
        status: nextStatus,
        saved_result_id: currentLead.saved_result_id,
        intent_score: currentLead.intent_score,
        whatsapp_key: currentLead.whatsapp_key,
        next_follow_up_at: nextFollowUpAt,
        updated_at: nextTimestamp,
        last_interaction_at: nextTimestamp,
      })
      .eq("org_id", orgId)
      .eq("id", leadId);

    if (input.expectedUpdatedAt) {
      updateQuery = updateQuery.eq("updated_at", input.expectedUpdatedAt);
    }

    const { data, error } = await updateQuery.select("*").maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to update lead status");
    }

    if (!data) {
      throw new Error(input.expectedUpdatedAt ? "Lead changed while editing" : "Failed to update lead status");
    }

    console.info("[LEADS] updateLeadOperationalState updated", {
      orgId,
      leadId,
      nextStatus,
      nextFollowUpAt,
    });

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
        status: (data as LeadRecord).status,
        next_follow_up_at: (data as LeadRecord).next_follow_up_at,
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
    console.info("[LEADS] updateLeadOperationalState event recorded", {
      orgId,
      leadId,
      idempotencyKey,
      eventType: "lead.update_succeeded",
    });

    return { lead: data as LeadRecord };
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

type SavedResultRecord = {
  id: string;
  org_id: string;
  user_email: string | null;
  user_name: string | null;
  payload: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

async function getSavedResultByIdempotencyKey(supabase: SupabaseClient, orgId: string, idempotencyKey: string) {
  console.info("[SAVED_RESULTS] lookup start", { orgId, idempotencyKey });
  const { data, error } = await supabase
    .from("saved_results")
    .select("*")
    .eq("org_id", normalizeString(orgId))
    .eq("idempotency_key", normalizeString(idempotencyKey))
    .maybeSingle();

  if (error) {
    console.error("[SAVED_RESULTS] lookup fail", { orgId, idempotencyKey, error });
    return { savedResult: null as SavedResultRecord | null, error };
  }

  console.info("[SAVED_RESULTS] lookup success", {
    orgId,
    idempotencyKey,
    found: Boolean(data),
    savedResultId: (data as SavedResultRecord | null)?.id || null,
  });
  return { savedResult: (data as SavedResultRecord | null) ?? null, error: null };
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

  const normalizedUserEmail = normalizeLeadEmail(input.userEmail || null) || null;
  const normalizedUserName = normalizeString(input.userName) || null;
  const normalizedLeadName = normalizeString(input.leadName) || null;
  const normalizedLeadEmail = normalizeLeadEmail(input.leadEmail || null) || null;
    const normalizedLeadPhone = normalizeLeadPhone(input.leadPhone || null) || null;
  const normalizedLeadSource = normalizeString(input.leadSource) || "app";
  const normalizedLeadStatus = input.leadStatus || "new";
  const normalizedIntentScore = typeof input.intentScore === "number" && !Number.isNaN(input.intentScore) ? input.intentScore : null;
  const normalizedWhatsappKey = normalizeLeadPhone(input.whatsappKey || null) || null;
  const normalizedLastInteractionAt = input.lastInteractionAt || null;
  const eventSource = input.eventSource || "app";

  const { savedResult: existingSavedResult, error: lookupError } = await getSavedResultByIdempotencyKey(supabase, orgId, idempotencyKey);
  if (lookupError) {
    throw lookupError;
  }

  console.info("[SAVED_RESULTS] lookup complete", {
    orgId,
    idempotencyKey,
    found: Boolean(existingSavedResult),
    savedResultId: existingSavedResult?.id || null,
  });

  let savedResultId = existingSavedResult?.id || "";
  let savedResultCreated = false;

  if (!savedResultId) {
    const { data, error } = await supabase
      .from("saved_results")
      .insert({
        org_id: orgId,
        user_email: normalizedUserEmail,
        user_name: normalizedUserName,
        payload: input.payload,
        idempotency_key: idempotencyKey,
      })
      .select("*")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        const retry = await getSavedResultByIdempotencyKey(supabase, orgId, idempotencyKey);
        if (retry.error) {
          throw retry.error;
        }
        if (retry.savedResult?.id) {
          savedResultId = retry.savedResult.id;
        }
      } else {
        console.error("[SAVED_RESULTS] direct insert failure", {
          orgId,
          idempotencyKey,
          payload: input.payload,
          error,
        });
        throw new Error(error?.message || "Failed to persist saved result");
      }
    } else {
      const row = data as SavedResultRecord;
      savedResultId = row.id;
      savedResultCreated = true;
      console.info("[SAVED_RESULTS] insert ok", {
        orgId,
        idempotencyKey,
        savedResultId,
      });
    }
  }

  if (!savedResultId) {
    throw new Error("Failed to persist saved result");
  }

  try {
    const { lead, created: leadCreated } = await findOrCreateLead(supabase, {
      orgId,
      name: normalizedLeadName || normalizedUserName || null,
      email: normalizedLeadEmail || normalizedUserEmail || null,
      phone: normalizedLeadPhone || null,
      source: normalizedLeadSource,
      status: normalizedLeadStatus,
      savedResultId,
      intentScore: normalizedIntentScore,
      whatsappKey: normalizedWhatsappKey || normalizedLeadPhone || null,
      lastInteractionAt: normalizedLastInteractionAt || undefined,
    });

    if (!lead) {
      throw new Error("Failed to persist lead");
    }

    console.info("[LEADS] findOrCreateLead ok", {
      orgId,
      idempotencyKey,
      leadId: lead.id,
      created: leadCreated,
    });

    console.info("[SAVED_RESULTS] direct persistence state", {
      orgId,
      idempotencyKey,
      user_id: lead.id,
      payload: input.payload,
      savedResultCreated,
      leadCreated,
    });

    try {
      console.info("[TENANT_EVENTS] app.saved_result_created start", {
        orgId,
        idempotencyKey,
        savedResultId,
      });
      await recordOperationalTenantEvent(supabase, {
        orgId,
        eventSource,
        eventType: "app.saved_result_created",
        dedupeKeyParts: [orgId, savedResultId, "saved_result_created"],
        payload: {
          org_id: orgId,
          saved_result_id: savedResultId,
          lead_id: lead.id,
          idempotency_key: idempotencyKey,
          created: savedResultCreated,
          reason_code: formatOperationalReason("persist_result", "success"),
        },
      });
      console.info("[TENANT_EVENTS] app.saved_result_created success", {
        orgId,
        idempotencyKey,
        savedResultId,
      });
    } catch (error) {
      console.error("[TENANT_EVENTS] app.saved_result_created fail", {
        orgId,
        idempotencyKey,
        savedResultId,
        error,
      });
      throw error;
    }

    try {
      console.info("[TENANT_EVENTS] lead sync start", {
        orgId,
        idempotencyKey,
        leadId: lead.id,
      });
      await recordOperationalTenantEvent(supabase, {
        orgId,
        eventSource,
        eventType: leadCreated ? "lead.created_from_app" : "lead.updated_from_app",
        dedupeKeyParts: [orgId, lead.id, savedResultId, leadCreated ? "created" : "updated"],
        payload: {
          lead_id: lead.id,
          saved_result_id: savedResultId,
          org_id: orgId,
          created: leadCreated,
        },
      });
      console.info("[TENANT_EVENTS] lead sync success", {
        orgId,
        idempotencyKey,
        leadId: lead.id,
      });
    } catch (error) {
      console.error("[TENANT_EVENTS] lead sync fail", {
        orgId,
        idempotencyKey,
        leadId: lead.id,
        error,
      });
      throw error;
    }

    try {
      console.info("[TENANT_USAGE] update start", {
        orgId,
        idempotencyKey,
        eventsCountDelta: 1,
        leadsDelta: leadCreated ? 1 : 0,
      });
      await bumpTenantUsageDaily(supabase, orgId, {
        events_count: 1,
        leads: leadCreated ? 1 : 0,
      });
      console.info("[TENANT_USAGE] update success", {
        orgId,
        idempotencyKey,
        eventsCountDelta: 1,
        leadsDelta: leadCreated ? 1 : 0,
      });
    } catch (error) {
      console.error("[TENANT_USAGE] update fail", {
        orgId,
        idempotencyKey,
        error,
      });
      throw error;
    }

    return {
      savedResultId,
      leadId: lead.id,
      savedResultCreated,
      leadCreated,
    } satisfies PersistSavedResultLeadResult;
  } catch (error) {
    console.error("[SAVED_RESULTS] direct persistence failure", {
      orgId,
      idempotencyKey,
      payload: input.payload,
      user_id: null,
      error,
    });
    throw error instanceof Error ? error : new Error("Failed to persist saved result");
  }
}

export async function updateLeadStatus(supabase: SupabaseClient, input: LeadStatusUpdateInput) {
  if (!input.status) {
    throw new Error("Missing lead status");
  }

  return updateLeadOperationalState(supabase, input);
}
