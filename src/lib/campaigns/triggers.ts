import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchCampaignAudience,
  CampaignTriggerRecord,
  fetchCampaignTriggers,
} from "./core";

export type TriggerEvent =
  | "product_created"
  | "tryon_completed"
  | "lead_inactive"
  | "lead_status_changed"
  | "low_stock";

export interface TriggerContext {
  orgId: string;
  event: TriggerEvent;
  payload: Record<string, unknown>;
}

export interface TriggerResult {
  campaignId: string;
  audienceFilters: Record<string, unknown>;
  shouldTrigger: boolean;
  reason: string;
}

const TRIGGER_CONFIGS: Record<
  TriggerEvent,
  {
    filters: Record<string, unknown>;
    campaignType: string;
  }
> = {
  product_created: {
    filters: {
      status: ["engaged", "qualified"],
      daysSinceInteraction: 30,
    },
    campaignType: "new_product",
  },
  tryon_completed: {
    filters: {
      status: ["engaged"],
      daysSinceInteraction: 7,
    },
    campaignType: "tryon_followup",
  },
  lead_inactive: {
    filters: {
      status: ["new", "engaged", "qualified"],
      daysSinceInteraction: 14,
    },
    campaignType: "reengagement",
  },
  lead_status_changed: {
    filters: {
      source: ["whatsapp"],
    },
    campaignType: "welcome",
  },
  low_stock: {
    filters: {
      status: ["qualified", "offer_sent"],
      hasPhone: true,
    },
    campaignType: "low_stock_alert",
  },
};

export function buildTriggerFilters(
  event: TriggerEvent,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const config = TRIGGER_CONFIGS[event];
  if (!config) {
    return {};
  }

  if (event === "lead_status_changed") {
    const newStatus = payload.new_status as string;
    if (newStatus === "qualified") {
      return {
        ...config.filters,
        source: ["app"],
      };
    }
  }

  return config.filters;
}

export async function evaluateTrigger(
  supabase: SupabaseClient,
  context: TriggerContext
): Promise<{ results: TriggerResult[]; error: Error | null }> {
  const { orgId, event, payload } = context;

  const { triggers, error: triggersError } = await fetchCampaignTriggers(supabase, orgId);

  if (triggersError) {
    return { results: [], error: triggersError };
  }

  const matchingTriggers = triggers.filter(
    (t) => t.trigger_type === event
  );

  const results: TriggerResult[] = [];

  for (const trigger of matchingTriggers) {
    const config = trigger.trigger_config as Record<string, unknown>;
    const shouldTrigger = config.enabled !== false;

    results.push({
      campaignId: trigger.campaign_id,
      audienceFilters: buildTriggerFilters(event, payload),
      shouldTrigger,
      reason: shouldTrigger ? `trigger_${event}_matched` : "trigger_disabled",
    });
  }

  return { results, error: null };
}

export async function executeTriggerForEvent(
  supabase: SupabaseClient,
  context: TriggerContext,
  onExecute?: (campaignId: string) => Promise<void>
): Promise<{ executed: string[]; error: Error | null }> {
  const { results, error } = await evaluateTrigger(supabase, context);

  if (error || results.length === 0) {
    return { executed: [], error };
  }

  const executed: string[] = [];

  for (const result of results) {
    if (!result.shouldTrigger) {
      continue;
    }

    if (onExecute) {
      try {
        await onExecute(result.campaignId);
        executed.push(result.campaignId);
      } catch (err) {
        console.warn("[CAMPAIGNS] trigger execution failed", {
          campaignId: result.campaignId,
          error: err,
        });
      }
    }
  }

  return { executed, error: null };
}

export async function processEventTrigger(
  supabase: SupabaseClient,
  event: TriggerEvent,
  orgId: string,
  payload: Record<string, unknown> = {}
): Promise<{ triggered: number; error: Error | null }> {
  const context: TriggerContext = {
    orgId,
    event,
    payload,
  };

  const { results, error } = await evaluateTrigger(supabase, context);

  if (error) {
    return { triggered: 0, error };
  }

  let triggered = 0;

  for (const result of results) {
    if (!result.shouldTrigger) {
      continue;
    }

    const filters = result.audienceFilters as Record<string, unknown>;

    if (event === "product_created") {
      const productId = payload.product_id as string;
      const productName = payload.product_name as string;

      triggered += 1;
    }
  }

  return { triggered, error: null };
}