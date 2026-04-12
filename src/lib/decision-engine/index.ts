import { DecisionAction, DecisionHistoryEntry, DecisionResult, DecisionWeightAdjustments, LeadContext } from "./types";

export * from "./types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeText = (value?: string | null) => (value || "").trim();

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

const normalizeOutcome = (outcome: string) => normalizeText(outcome).toUpperCase();

const isDecisionAction = (value: string): value is DecisionAction => {
  const allowed: DecisionAction[] = [
    "PUSH_WHATSAPP_CONVERSION",
    "SHOW_VARIATION_LOOK",
    "OFFER_INCENTIVE",
    "REASSURE_USER",
    "WAIT",
    "TRIGGER_HUMAN_AGENT",
    "SEND_WHATSAPP_MESSAGE",
    "OFFER_DISCOUNT",
    "SUGGEST_NEW_LOOK",
  ];

  return (allowed as string[]).includes(value);
};

const actionOrFallback = (value: string, fallback: DecisionAction): DecisionAction => {
  const normalized = normalizeAction(value);
  return isDecisionAction(normalized) ? normalized : fallback;
};

function readTryOnCount(context: LeadContext) {
  const tryOnFromContext = context.last_tryon as Record<string, unknown> | null;
  const whatsappContext = context.whatsapp_context as Record<string, unknown> | null;

  const explicitCount = Number((tryOnFromContext?.tryOnCount as number | undefined) || (whatsappContext?.tryOnCount as number | undefined) || 0);
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return explicitCount;
  }

  return tryOnFromContext ? 1 : 0;
}

function buildActionGroups() {
  return {
    whatsapp: new Set<DecisionAction>(["PUSH_WHATSAPP_CONVERSION", "SEND_WHATSAPP_MESSAGE"]),
    variation: new Set<DecisionAction>(["SHOW_VARIATION_LOOK", "SUGGEST_NEW_LOOK"]),
    incentive: new Set<DecisionAction>(["OFFER_INCENTIVE", "OFFER_DISCOUNT"]),
  };
}

export function adjustDecisionWeights(history: Array<DecisionHistoryEntry | Record<string, unknown> | null | undefined> = []): DecisionWeightAdjustments {
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
      action: actionOrFallback(String(entry?.action || ""), "WAIT"),
      outcome: normalizeOutcome(String(entry?.outcome || "")),
      timestamp: normalizeText(String(entry?.timestamp || "")),
    }))
    .slice(-20);

  if (!entries.length) {
    return weights;
  }

  const groups = buildActionGroups();
  const total = entries.length;

  entries.forEach((entry, index) => {
    const recency = 0.55 + ((index + 1) / total) * 0.45;

    if (groups.whatsapp.has(entry.action)) {
      if (entry.outcome === "WHATSAPP_CLICKED") {
        weights.SEND_WHATSAPP_MESSAGE += 1.35 * recency;
      }
      if (entry.outcome === "NO_RESPONSE" || entry.outcome === "DROPPED_SESSION") {
        weights.SEND_WHATSAPP_MESSAGE -= 1.6 * recency;
        weights.TRIGGER_HUMAN_AGENT += 0.35 * recency;
      }
    }

    if (groups.variation.has(entry.action)) {
      if (entry.outcome === "PURCHASE_COMPLETED") {
        weights.SUGGEST_NEW_LOOK += 1.75 * recency;
      }
      if (entry.outcome === "REQUESTED_VARIATION") {
        weights.SUGGEST_NEW_LOOK += 1.15 * recency;
      }
    }

    if (groups.incentive.has(entry.action)) {
      if (entry.outcome === "PURCHASE_COMPLETED") {
        weights.OFFER_DISCOUNT += 1.5 * recency;
      }
      if (entry.outcome === "NO_RESPONSE") {
        weights.OFFER_DISCOUNT -= 0.55 * recency;
      }
    }

    if (entry.outcome === "DROPPED_SESSION") {
      weights.TRIGGER_HUMAN_AGENT += 0.25 * recency;
      weights.WAIT -= 0.15 * recency;
    }
  });

  return weights;
}

function getAdaptiveConfidence(baseConfidence: number, selectedAction: DecisionAction, weightAdjustments: DecisionWeightAdjustments) {
  const bias = Number(weightAdjustments[selectedAction] || 0);
  const delta = clamp(bias * 0.08, -0.25, 0.25);
  return clamp(baseConfidence + delta, 0.35, 0.99);
}

function isWhatsAppEngaged(context: LeadContext) {
  const whatsappContext = context.whatsapp_context as Record<string, unknown> | null;
  const hasClicked = Boolean(
    whatsappContext?.clicked_at ||
      whatsappContext?.whatsappClickedAt ||
      whatsappContext?.last_wa_click_at ||
      context.timestamps?.last_wa_click_at
  );
  return hasClicked;
}

function resolveDecision(context: LeadContext, weightAdjustments: DecisionWeightAdjustments): Omit<DecisionResult, "adaptiveConfidence" | "weightAdjustments" | "chosenAction"> {
  const intent_score = typeof context.intent_score === "number" ? context.intent_score : 0;
  const hasTryOn = Boolean(context.last_tryon && ((context.last_tryon as Record<string, unknown>).status === "completed" || context.last_tryon));
  const waEngaged = isWhatsAppEngaged(context);
  const tryOnCount = readTryOnCount(context);
  const lastInteractionAt = context.timestamps?.last_interaction_at ? new Date(context.timestamps.last_interaction_at).getTime() : Date.now();
  const idleTimeMinutes = (Date.now() - lastInteractionAt) / (1000 * 60);

  if (hasTryOn && !waEngaged) {
    return {
      action: "SEND_WHATSAPP_MESSAGE",
      reason: "A foto/try-on já existe e o fechamento por WhatsApp segue sendo o melhor próximo passo.",
      confidence: 0.95,
      payload: {
        last_tryon: context.last_tryon,
        trigger: "tryon_without_whatsapp",
      },
    };
  }

  if (intent_score >= 7) {
    return {
      action: "SEND_WHATSAPP_MESSAGE",
      reason: "O nível de intenção está alto; a decisão certa é converter agora no WhatsApp.",
      confidence: 0.9,
      payload: {
        priority: "high",
        cta: "Finalizar via WhatsApp",
      },
    };
  }

  if (tryOnCount >= 3) {
    const discountWeight = weightAdjustments.OFFER_DISCOUNT || 0;
    const variationWeight = weightAdjustments.SUGGEST_NEW_LOOK || 0;

    if (discountWeight >= variationWeight && discountWeight >= 0) {
      return {
        action: "OFFER_DISCOUNT",
        reason: "Exploração alta e histórico favorável a incentivo indicam reduzir fricção agora.",
        confidence: 0.86,
        payload: {
          discount_code: "VENUSFIRST",
          type: "free_shipping",
        },
      };
    }

    return {
      action: "SUGGEST_NEW_LOOK",
      reason: "Há sinal de exploração recorrente; uma nova variação pode destravar a compra.",
      confidence: 0.85,
      payload: {
        suggestion_type: "alternative_style",
      },
    };
  }

  if (intent_score >= 4 && intent_score < 7) {
    const variationWeight = weightAdjustments.SUGGEST_NEW_LOOK || 0;
    const discountWeight = weightAdjustments.OFFER_DISCOUNT || 0;

    if (discountWeight > variationWeight + 0.5) {
      return {
        action: "OFFER_DISCOUNT",
        reason: "O histórico mostra melhor conversão com incentivo nesta faixa de intenção.",
        confidence: 0.8,
        payload: {
          discount_code: "VENUSFIRST",
          type: "free_shipping",
        },
      };
    }

    return {
      action: "SUGGEST_NEW_LOOK",
      reason: "Há interesse real e histórico suficiente para oferecer uma variação mais precisa.",
      confidence: 0.8,
      payload: {
        suggestion_type: "alternative_style",
      },
    };
  }

  if (idleTimeMinutes > 30 && hasTryOn) {
    return {
      action: "TRIGGER_HUMAN_AGENT",
      reason: "Houve um intervalo relevante depois de uma interação de alto valor; uma pessoa pode retomar melhor.",
      confidence: 0.75,
      payload: {
        alert_type: "re-engagement",
      },
    };
  }

  if (intent_score > 0 && intent_score < 4) {
    return {
      action: "WAIT",
      reason: "A intenção ainda está baixa; o melhor agora é esperar e manter a presença leve.",
      confidence: 0.7,
      payload: {
        message: "Sua presença está sendo lida com calma. Posso afinar a leitura quando você quiser.",
      },
    };
  }

  if (idleTimeMinutes > 30 && hasTryOn) {
    return {
      action: "TRIGGER_HUMAN_AGENT",
      reason: "Houve um intervalo relevante depois de uma interação de alto valor; uma pessoa pode retomar melhor.",
      confidence: 0.75,
      payload: {
        alert_type: "re-engagement",
      },
    };
  }

  return {
    action: "WAIT",
    reason: "Sem sinal forte o suficiente para agir agora.",
    confidence: 0.5,
  };
}

export function decideNextAction(leadContext: any): DecisionResult & { normalizedIntentScore: number } {
  const rawIntent = typeof leadContext?.intent_score === "number" ? leadContext.intent_score : 0;
  const normalizedScore = rawIntent > 10 ? rawIntent / 10 : rawIntent;

  const context: LeadContext = {
    id: leadContext?.id || leadContext?.leadId,
    intent_score: normalizedScore,
    last_tryon: leadContext?.last_tryon || leadContext?.lastTryon || null,
    last_products_viewed: leadContext?.last_products_viewed || leadContext?.lastProductsViewed || [],
    last_recommendations: leadContext?.last_recommendations || leadContext?.lastRecommendations || [],
    whatsapp_context: leadContext?.whatsapp_context || leadContext?.whatsappContext || null,
    emotional_state: leadContext?.emotional_state || leadContext?.emotionalState || null,
    last_action: leadContext?.last_action || leadContext?.lastAction || null,
    last_action_outcome: leadContext?.last_action_outcome || leadContext?.lastActionOutcome || null,
    action_history: leadContext?.action_history || leadContext?.actionHistory || [],
    timestamps: {
      last_interaction_at: leadContext?.updated_at || leadContext?.lastInteractionAt || new Date().toISOString(),
      last_tryon_at: leadContext?.last_tryon?.generated_at || leadContext?.lastTryon?.generated_at || null,
      last_wa_click_at:
        leadContext?.whatsapp_context?.whatsappClickedAt ||
        leadContext?.whatsappContext?.whatsappClickedAt ||
        leadContext?.whatsapp_context?.clicked_at ||
        leadContext?.whatsappContext?.clicked_at ||
        null,
    },
  };

  const weightAdjustments = adjustDecisionWeights(context.action_history || []);
  const resolved = resolveDecision(context, weightAdjustments);
  const adaptiveConfidence = getAdaptiveConfidence(resolved.confidence, resolved.action, weightAdjustments);

  return {
    ...resolved,
    action: resolved.action,
    chosenAction: resolved.action,
    confidence: resolved.confidence,
    adaptiveConfidence,
    weightAdjustments,
    normalizedIntentScore: normalizedScore,
  };
}

export async function trackDecisionOutcome(leadId: string, action: DecisionAction, outcome: string) {
  return {
    leadId,
    action,
    outcome,
  };
}
