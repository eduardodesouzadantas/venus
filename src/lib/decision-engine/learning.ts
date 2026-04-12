"server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { upsertLeadContextByLeadId } from "@/lib/lead-context";
import type { DecisionAction, DecisionHistoryEntry, DecisionOutcome, DecisionWeightAdjustments } from "./types";

type RecordDecisionOutcomeInput = {
  lead_id: string;
  action: DecisionAction | string;
  outcome: DecisionOutcome | string;
  timestamp?: string | number | Date;
};

type LeadRow = {
  id: string;
  org_id: string;
};

const normalizeText = (value?: string | null) => (value || "").trim();

const toIsoTimestamp = (value?: string | number | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
};

const normalizeAction = (action: string): DecisionAction | string => {
  const normalized = normalizeText(action).toUpperCase();
  const aliases: Record<string, DecisionAction> = {
    PUSH_WHATSAPP_CONVERSION: "SEND_WHATSAPP_MESSAGE",
    SEND_WHATSAPP_MESSAGE: "SEND_WHATSAPP_MESSAGE",
    SHOW_VARIATION_LOOK: "SUGGEST_NEW_LOOK",
    SUGGEST_NEW_LOOK: "SUGGEST_NEW_LOOK",
    OFFER_INCENTIVE: "OFFER_DISCOUNT",
    OFFER_DISCOUNT: "OFFER_DISCOUNT",
    REASSURE_USER: "WAIT",
    WAIT: "WAIT",
    TRIGGER_HUMAN_AGENT: "TRIGGER_HUMAN_AGENT",
  };

  return aliases[normalized] || normalized;
};

const normalizeOutcome = (outcome: string): DecisionOutcome | string => {
  const normalized = normalizeText(outcome).toUpperCase();
  const allowed: DecisionOutcome[] = [
    "WHATSAPP_CLICKED",
    "PURCHASE_COMPLETED",
    "NO_RESPONSE",
    "DROPPED_SESSION",
    "REQUESTED_VARIATION",
  ];
  return (allowed.includes(normalized as DecisionOutcome) ? normalized : normalized) as DecisionOutcome | string;
};

const ACTION_GROUPS = {
  whatsapp: new Set<DecisionAction>(["PUSH_WHATSAPP_CONVERSION", "SEND_WHATSAPP_MESSAGE"]),
  variation: new Set<DecisionAction>(["SHOW_VARIATION_LOOK", "SUGGEST_NEW_LOOK"]),
  incentive: new Set<DecisionAction>(["OFFER_INCENTIVE", "OFFER_DISCOUNT"]),
};

const WEIGHT_KEYS = [
  "SEND_WHATSAPP_MESSAGE",
  "SUGGEST_NEW_LOOK",
  "OFFER_DISCOUNT",
  "TRIGGER_HUMAN_AGENT",
  "WAIT",
] as const;

export function adjustDecisionWeights(history: Array<Partial<DecisionHistoryEntry> | Record<string, unknown>> = []): DecisionWeightAdjustments {
  const weights: DecisionWeightAdjustments = {
    SEND_WHATSAPP_MESSAGE: 0,
    SUGGEST_NEW_LOOK: 0,
    OFFER_DISCOUNT: 0,
    TRIGGER_HUMAN_AGENT: 0,
    WAIT: 0,
  };

  const entries = history
    .filter(Boolean)
    .map((entry) => ({
      action: normalizeAction(String(entry.action || "")),
      outcome: normalizeOutcome(String(entry.outcome || "")),
      timestamp: toIsoTimestamp(entry.timestamp as string | number | Date | undefined),
    }))
    .slice(-20);

  if (!entries.length) {
    return weights;
  }

  const total = entries.length;

  entries.forEach((entry, index) => {
    const recency = 0.55 + ((index + 1) / total) * 0.45;
    const outcome = normalizeText(String(entry.outcome)).toUpperCase();
    const action = normalizeAction(String(entry.action)) as DecisionAction;

    if (ACTION_GROUPS.whatsapp.has(action)) {
      if (outcome === "WHATSAPP_CLICKED") {
        weights.SEND_WHATSAPP_MESSAGE += 1.35 * recency;
      }
      if (outcome === "NO_RESPONSE" || outcome === "DROPPED_SESSION") {
        weights.SEND_WHATSAPP_MESSAGE -= 1.6 * recency;
        weights.TRIGGER_HUMAN_AGENT += 0.35 * recency;
      }
    }

    if (ACTION_GROUPS.variation.has(action)) {
      if (outcome === "PURCHASE_COMPLETED") {
        weights.SUGGEST_NEW_LOOK += 1.75 * recency;
      }
      if (outcome === "REQUESTED_VARIATION") {
        weights.SUGGEST_NEW_LOOK += 1.15 * recency;
      }
    }

    if (ACTION_GROUPS.incentive.has(action)) {
      if (outcome === "PURCHASE_COMPLETED") {
        weights.OFFER_DISCOUNT += 1.5 * recency;
      }
      if (outcome === "NO_RESPONSE") {
        weights.OFFER_DISCOUNT -= 0.55 * recency;
      }
    }

    if (outcome === "DROPPED_SESSION") {
      weights.TRIGGER_HUMAN_AGENT += 0.25 * recency;
      weights.WAIT -= 0.15 * recency;
    }
  });

  return weights;
}

export async function recordDecisionOutcome(input: RecordDecisionOutcomeInput) {
  const leadId = normalizeText(input.lead_id);
  if (!leadId) {
    throw new Error("Missing lead_id");
  }

  const supabase = createAdminClient();
  const timestamp = toIsoTimestamp(input.timestamp);
  const action = normalizeAction(input.action);
  const outcome = normalizeOutcome(input.outcome);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, org_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    throw leadError;
  }

  if (!lead) {
    return null;
  }

  const historyEntry: DecisionHistoryEntry = {
    action,
    outcome,
    timestamp,
  };

  const { data: existingContext } = await supabase
    .from("lead_context")
    .select("action_history, whatsapp_context, last_action, last_action_outcome")
    .eq("org_id", lead.org_id)
    .eq("user_id", lead.id)
    .maybeSingle();

  const previousHistory = Array.isArray(existingContext?.action_history) ? existingContext.action_history : [];
  const nextHistory = [...previousHistory, historyEntry].slice(-50);

  return upsertLeadContextByLeadId(supabase, {
    orgId: lead.org_id,
    leadId: lead.id,
    lastAction: action,
    lastActionOutcome: outcome,
    actionHistory: nextHistory,
    whatsappContext: {
      ...(existingContext?.whatsapp_context && typeof existingContext.whatsapp_context === "object" && !Array.isArray(existingContext.whatsapp_context)
        ? existingContext.whatsapp_context
        : {}),
      lastAction: action,
      lastActionOutcome: outcome,
      lastActionAt: timestamp,
    },
  });
}
