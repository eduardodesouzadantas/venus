import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadStatus = "new" | "engaged" | "qualified" | "offer_sent" | "won" | "lost";

export function getLeadStatusEventType(status: LeadStatus) {
  switch (status) {
    case "offer_sent":
      return "lead.offer_sent";
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
  won: 4,
  lost: 5,
};

function resolveLeadStatus(existingStatus: LeadStatus | null | undefined, nextStatus?: LeadStatus) {
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

  const nextTimestamp = input.lastInteractionAt || new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    last_interaction_at: nextTimestamp,
    updated_at: nextTimestamp,
  };

  if (hasStatus) {
    updatePayload.status = input.status;
  }

  if (hasFollowUp) {
    updatePayload.next_follow_up_at = input.nextFollowUpAt || null;
  }

  const { data, error } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update lead status");
  }

  return { lead: data as LeadRecord };
}

export async function updateLeadStatus(supabase: SupabaseClient, input: LeadStatusUpdateInput) {
  if (!input.status) {
    throw new Error("Missing lead status");
  }

  return updateLeadOperationalState(supabase, input);
}
