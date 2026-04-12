export type DecisionAction =
    | "PUSH_WHATSAPP_CONVERSION"
    | "SHOW_VARIATION_LOOK"
    | "OFFER_INCENTIVE"
    | "REASSURE_USER"
    | "WAIT"
    | "TRIGGER_HUMAN_AGENT"
    | "SEND_WHATSAPP_MESSAGE"
    | "OFFER_DISCOUNT"
    | "SUGGEST_NEW_LOOK";

export type DecisionOutcome =
    | "WHATSAPP_CLICKED"
    | "PURCHASE_COMPLETED"
    | "NO_RESPONSE"
    | "DROPPED_SESSION"
    | "REQUESTED_VARIATION";

export interface DecisionHistoryEntry {
    action: DecisionAction | string;
    outcome: DecisionOutcome | string;
    timestamp: string;
}

export interface DecisionWeightAdjustments {
    [key: string]: number;
}

export interface LeadContext {
    id?: string;
    intent_score: number; // 0-10 or 0-100? Assuming 0-10 based on user logic (intent_score >= 7)
    last_tryon: any | null;
    last_products_viewed: any[] | null;
    last_recommendations: any[] | null;
    whatsapp_context: any | null;
    emotional_state: any | null;
    last_action?: string | null;
    last_action_outcome?: string | null;
    action_history?: DecisionHistoryEntry[] | null;
    timestamps: {
        last_interaction_at?: string;
        last_tryon_at?: string;
        last_wa_click_at?: string;
        created_at?: string;
    };
}

export interface DecisionResult {
    action: DecisionAction;
    chosenAction: DecisionAction;
    reason: string;
    confidence: number;
    adaptiveConfidence: number;
    weightAdjustments: DecisionWeightAdjustments;
    payload?: Record<string, any>;
}
