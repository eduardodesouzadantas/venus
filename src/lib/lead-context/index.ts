"server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingData } from "@/types/onboarding";
import type { ResultPayload } from "@/types/result";

type LeadRecord = {
  id: string;
  org_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_key: string | null;
  saved_result_id: string | null;
  intent_score: number | null;
  last_interaction_at: string | null;
};

export type LeadContextRecord = {
  id: string;
  user_id: string;
  org_id: string;
  profile_data: Record<string, unknown> | null;
  style_profile: Record<string, unknown> | null;
  colorimetry: Record<string, unknown> | null;
  body_analysis: Record<string, unknown> | null;
  intent_score: number | null;
  emotional_state: Record<string, unknown> | null;
  last_tryon: Record<string, unknown> | null;
  last_products_viewed: unknown[] | null;
  last_recommendations: unknown[] | null;
  whatsapp_context: Record<string, unknown> | null;
  updated_at: string | null;
};

export type LeadContextIdentity = {
  orgId: string;
  leadId?: string | null;
  savedResultId?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type LeadContextPatch = {
  profileData?: unknown;
  styleProfile?: unknown;
  colorimetry?: unknown;
  bodyAnalysis?: unknown;
  intentScore?: number | null;
  emotionalState?: unknown;
  lastTryon?: unknown;
  lastProductsViewed?: unknown[] | null;
  lastRecommendations?: unknown[] | null;
  whatsappContext?: unknown;
};

export type LeadIntentEventType =
  | "tryon_generated"
  | "variation_requested"
  | "whatsapp_clicked"
  | "product_revisited"
  | "inactive_24h"
  | "recommendation_ignored"
  | "onboarding_completed";

type IntentScoreMetadata = {
  now?: string | number | Date | null;
  lastActivityAt?: string | number | Date | null;
};

const normalizeText = (value?: string | null) => (value || "").trim();
const normalizePhone = (value?: string | null) => normalizeText(value).replace(/\D/g, "");
const normalizeEmail = (value?: string | null) => normalizeText(value).toLowerCase();

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const INTENT_SCORE_DELTAS: Record<LeadIntentEventType, number> = {
  tryon_generated: 2,
  variation_requested: 1,
  whatsapp_clicked: 3,
  product_revisited: 1,
  inactive_24h: -2,
  recommendation_ignored: -1,
  onboarding_completed: 0,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toTimeValue(value?: string | number | Date | null) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function mergeRecords(base: Record<string, unknown> | null, patch: unknown) {
  return { ...(base || {}), ...(asRecord(patch) || {}) };
}

function uniqueArray(values: unknown[]) {
  const seen = new Set<string>();
  const next: unknown[] = [];

  for (const value of values) {
    const key = typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>).id
          ? String((value as Record<string, unknown>).id)
          : JSON.stringify(value)
        : JSON.stringify(value);

    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }

  return next;
}

function mergeArray(existing: unknown[] | null | undefined, patch: unknown[] | null | undefined, limit = 10) {
  const current = asArray(existing);
  const incoming = asArray(patch);

  if (!incoming.length) {
    return current.slice(0, limit);
  }

  return uniqueArray([...incoming, ...current]).slice(0, limit);
}

export function updateIntentScore(eventType: string, currentScore = 0, metadata: IntentScoreMetadata = {}) {
  const normalizedEventType = (eventType || "").trim() as LeadIntentEventType;
  const nextCurrentScore = Number.isFinite(currentScore) ? currentScore : 0;
  const delta = INTENT_SCORE_DELTAS[normalizedEventType] ?? 0;

  if (normalizedEventType === "inactive_24h") {
    const lastActivityAt = toTimeValue(metadata.lastActivityAt);
    const now = toTimeValue(metadata.now) ?? Date.now();

    if (lastActivityAt && now - lastActivityAt <= DAY_IN_MS) {
      return Math.max(0, Math.min(100, nextCurrentScore));
    }
  }

  return Math.max(0, Math.min(100, nextCurrentScore + delta));
}

async function resolveLeadByIdentity(supabase: SupabaseClient, input: LeadContextIdentity) {
  const orgId = normalizeText(input.orgId);
  if (!orgId) {
    throw new Error("Missing orgId");
  }

  const columns = "id, org_id, name, email, phone, whatsapp_key, saved_result_id";

  const leadId = normalizeText(input.leadId || null);
  if (leadId) {
    const { data, error } = await supabase.from("leads").select(columns).eq("org_id", orgId).eq("id", leadId).maybeSingle();
    if (error) throw error;
    if (data) return data as LeadRecord;
  }

  const savedResultId = normalizeText(input.savedResultId || null);
  if (savedResultId) {
    const { data, error } = await supabase.from("leads").select(columns).eq("org_id", orgId).eq("saved_result_id", savedResultId).maybeSingle();
    if (error) throw error;
    if (data) return data as LeadRecord;
  }

  const phone = normalizePhone(input.phone || null);
  if (phone) {
    const { data, error } = await supabase
      .from("leads")
      .select(columns)
      .eq("org_id", orgId)
      .or(`phone.eq.${phone},whatsapp_key.eq.${phone}`)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as LeadRecord;
  }

  const email = normalizeEmail(input.email || null);
  if (email) {
    const { data, error } = await supabase.from("leads").select(columns).eq("org_id", orgId).eq("email", email).maybeSingle();
    if (error) throw error;
    if (data) return data as LeadRecord;
  }

  return null;
}

export async function loadLeadContextByIdentity(supabase: SupabaseClient, input: LeadContextIdentity) {
  const lead = await resolveLeadByIdentity(supabase, input);
  if (!lead) {
    return { lead: null as LeadRecord | null, context: null as LeadContextRecord | null };
  }

  const { data, error } = await supabase
    .from("lead_context")
    .select("*")
    .eq("org_id", lead.org_id)
    .eq("user_id", lead.id)
    .maybeSingle();

  if (error) throw error;

  return { lead, context: (data as LeadContextRecord | null) ?? null };
}

export async function upsertLeadContext(supabase: SupabaseClient, input: LeadContextIdentity & LeadContextPatch) {
  const lead = await resolveLeadByIdentity(supabase, input);
  if (!lead) {
    return null;
  }

  return upsertLeadContextByLeadId(supabase, {
    orgId: lead.org_id,
    leadId: lead.id,
    profileData: input.profileData,
    styleProfile: input.styleProfile,
    colorimetry: input.colorimetry,
    bodyAnalysis: input.bodyAnalysis,
    intentScore: input.intentScore,
    emotionalState: input.emotionalState,
    lastTryon: input.lastTryon,
    lastProductsViewed: input.lastProductsViewed,
    lastRecommendations: input.lastRecommendations,
    whatsappContext: input.whatsappContext,
  });
}

export async function upsertLeadContextByLeadId(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string } & LeadContextPatch
) {
  const orgId = normalizeText(input.orgId);
  const leadId = normalizeText(input.leadId);

  if (!orgId || !leadId) {
    throw new Error("Missing lead context identifiers");
  }

  const { data: existing, error: existingError } = await supabase
    .from("lead_context")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", leadId)
    .maybeSingle();

  if (existingError) throw existingError;

  const current = (existing as LeadContextRecord | null) ?? null;
  const payload = {
    org_id: orgId,
    user_id: leadId,
    profile_data: mergeRecords(asRecord(current?.profile_data), input.profileData),
    style_profile: mergeRecords(asRecord(current?.style_profile), input.styleProfile),
    colorimetry: mergeRecords(asRecord(current?.colorimetry), input.colorimetry),
    body_analysis: mergeRecords(asRecord(current?.body_analysis), input.bodyAnalysis),
    intent_score:
      typeof input.intentScore === "number" && !Number.isNaN(input.intentScore)
        ? input.intentScore
        : current?.intent_score ?? 0,
    emotional_state: mergeRecords(asRecord(current?.emotional_state), input.emotionalState),
    last_tryon: mergeRecords(asRecord(current?.last_tryon), input.lastTryon),
    last_products_viewed: mergeArray(current?.last_products_viewed, input.lastProductsViewed, 12),
    last_recommendations: mergeArray(current?.last_recommendations, input.lastRecommendations, 6),
    whatsapp_context: mergeRecords(asRecord(current?.whatsapp_context), input.whatsappContext),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("lead_context")
    .upsert(payload, { onConflict: "org_id,user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as LeadContextRecord;
}

export async function updateLeadContextTryOn(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    savedResultId?: string | null;
    leadId?: string | null;
    personImageUrl?: string | null;
    garmentImageUrl?: string | null;
    generatedImageUrl?: string | null;
    lookName?: string | null;
    lookId?: string | null;
    category?: string | null;
    requestId?: string | null;
    intentScore?: number | null;
  }
) {
  return upsertLeadContext(supabase, {
    orgId: input.orgId,
    leadId: input.leadId || null,
    savedResultId: input.savedResultId || null,
    lastTryon: {
      personImageUrl: input.personImageUrl || null,
      garmentImageUrl: input.garmentImageUrl || null,
      generatedImageUrl: input.generatedImageUrl || null,
      lookName: input.lookName || null,
      lookId: input.lookId || null,
      category: input.category || null,
      requestId: input.requestId || null,
      updatedAt: new Date().toISOString(),
    },
    intentScore: input.intentScore ?? null,
  });
}

export async function updateLeadContextProducts(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    savedResultId?: string | null;
    leadId?: string | null;
    products: unknown[];
    source?: string | null;
    lookId?: string | null;
    lookName?: string | null;
    intentScore?: number | null;
  }
) {
  return upsertLeadContext(supabase, {
    orgId: input.orgId,
    leadId: input.leadId || null,
    savedResultId: input.savedResultId || null,
    lastProductsViewed: input.products,
    emotionalState: input.source
      ? {
          source: input.source,
          updatedAt: new Date().toISOString(),
        }
      : null,
      whatsappContext: input.lookId || input.lookName
      ? {
          lastLookId: input.lookId || null,
          lastLookName: input.lookName || null,
        }
      : null,
    intentScore: input.intentScore ?? null,
  });
}

export async function updateLeadContextIntent(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    leadId?: string | null;
    savedResultId?: string | null;
    intentScore: number;
    emotionalState?: Record<string, unknown> | null;
    whatsappContext?: Record<string, unknown> | null;
  }
) {
  return upsertLeadContext(supabase, {
    orgId: input.orgId,
    leadId: input.leadId || null,
    savedResultId: input.savedResultId || null,
    intentScore: input.intentScore,
    emotionalState: input.emotionalState || null,
    whatsappContext: input.whatsappContext || null,
  });
}

export function buildLeadContextProfileFromOnboarding(input: {
  data: OnboardingData;
  result: ResultPayload;
  leadName?: string | null;
  leadPhone?: string | null;
  leadEmail?: string | null;
  orgId?: string | null;
  orgSlug?: string | null;
  savedResultId?: string | null;
  intentScore?: number | null;
}) {
  const styleIdentity = input.result.hero?.dominantStyle || input.data.intent.styleDirection || "";

  return {
    profileData: {
      name: input.leadName || input.data.contact?.name || "",
      phone: input.leadPhone || input.data.contact?.phone || "",
      email: input.leadEmail || input.data.contact?.email || "",
      orgId: input.orgId || "",
      orgSlug: input.orgSlug || "",
      source: "onboarding",
      savedResultId: input.savedResultId || "",
    },
    styleProfile: {
      styleIdentity,
      dominantStyle: input.result.hero?.dominantStyle || styleIdentity,
      imageGoal: input.data.intent.imageGoal || "",
      styleDirection: input.data.intent.styleDirection || "",
      paletteFamily: input.result.palette.family || "",
      fit: input.data.body.fit || "",
      metal: input.data.colors.metal || input.result.palette.metal || "",
    },
    colorimetry: input.data.colorimetry || {},
    bodyAnalysis: {
      fit: input.data.body.fit || "",
      faceLines: input.data.body.faceLines || "",
      hairLength: input.data.body.hairLength || "",
      highlight: input.data.body.highlight || [],
      camouflage: input.data.body.camouflage || [],
      facePhoto: input.data.scanner.facePhoto ? "yes" : "no",
      bodyPhoto: input.data.scanner.bodyPhoto ? "yes" : "no",
    },
    intentScore: updateIntentScore(
      "onboarding_completed",
      input.intentScore ?? Math.round(Number(input.data.intent.satisfaction || 0) * 10)
    ),
    emotionalState: {
      source: "onboarding",
      stage: "result_generated",
      updatedAt: new Date().toISOString(),
    },
    lastRecommendations: input.result.looks?.slice(0, 3) || [],
    whatsappContext: {
      styleIdentity,
      imageGoal: input.data.intent.imageGoal || "",
      paletteFamily: input.result.palette.family || "",
      fit: input.data.body.fit || "",
      metal: input.data.colors.metal || input.result.palette.metal || "",
      resultId: input.savedResultId || "",
    },
  };
}
