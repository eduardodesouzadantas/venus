import "server-only";

import type { ConsultationProfile } from "@/lib/consultation-profile";

export type ConversationState =
  | "DISCOVERY"
  | "STYLE_ANALYSIS"
  | "TRY_ON_GUIDED"
  | "LOOK_RECOMMENDATION"
  | "CATALOG_ASSISTED"
  | "CLOSING"
  | "POST_PURCHASE"
  | "REENGAGEMENT";

export type ResponseTone = "friendly" | "consultive" | "direct" | "closing";

export type CTAType =
  | "ask_question"
  | "suggest_tryon"
  | "show_look"
  | "show_product"
  | "close_deal"
  | "schedule_call"
  | "follow_up"
  | "none";

export type PersuasionLevel = "minimal" | "soft" | "moderate" | "high";

export interface ConversationContext {
  orgId: string;
  userId: string;
  conversationId: string;
  currentState: ConversationState;
  previousState: ConversationState | null;
  messageCount: number;
  lastMessageAt: string | null;
  lastUserMessage: string | null;
  intentScore: number;
  tryOnCount: number;
  viewedProducts: string[];
  hasStyleProfile: boolean;
  hasPurchaseIntent: boolean;
  closingTriggers: ClosingTrigger[];
  hasPhotoUploaded: boolean;
  photoUploadAt: string | null;
  analysisInProgress: boolean;
  analysisCompleted: boolean;
  firstWowDelivered: boolean;
}

export interface ClosingTrigger {
  type: "purchase_intent" | "price_inquiry" | "size_inquiry" | "comparison" | "objection" | "positive_feedback";
  confidence: number;
  detectedAt: string;
  messageSnippet: string;
}

export interface MessageAnalysis {
  text: string;
  tokens: string[];
  detectedIntents: string[];
  detectedEntities: Record<string, string[]>;
  sentiment: "positive" | "negative" | "neutral" | "curious";
  isClosingSignal: boolean;
  needsContext: boolean;
}

export interface ResponseStrategy {
  tone: ResponseTone;
  maxLength: number;
  persuasionLevel: PersuasionLevel;
  cta: CTAType;
  ctaText: string | null;
  shouldUseMemory: boolean;
  shouldShowLook: boolean;
  shouldShowProduct: boolean;
  shouldAskQuestion: boolean;
  prohibitedPatterns: string[];
  requiredContext: string[];
}

export interface ConversationStateConfig {
  state: ConversationState;
  name: string;
  description: string;
  defaultTone: ResponseTone;
  maxResponseLength: number;
  persuasionLevel: PersuasionLevel;
  defaultCTA: CTAType;
  minMessagesForTransition: number;
  transitionTriggers: string[];
}

export interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  trigger: string;
  conditions: string[];
}

export interface UserMemory {
  userId: string;
  orgId: string;
  styleIdentity?: string;
  styleDirection?: string;
  consultationProfile?: ConsultationProfile;
  imageGoal?: string;
  paletteFamily?: string;
  fit?: string;
  metal?: string;
  preferredCategories?: string[];
  lastInteractionAt?: string;
  lastLookShown?: string;
  conversationCount: number;
  totalTryOns: number;
  converted: boolean;
  tags: string[];
}

export interface OrgMemory {
  orgId: string;
  userId: string;
  isReturningCustomer: boolean;
  previousPurchases?: string[];
  lastLookShown?: string;
  conversationHistory: Array<{
    state: ConversationState;
    at: string;
    messagePreview: string;
  }>;
}

export interface ConversationResponse {
  message: string;
  state: ConversationState;
  strategy: ResponseStrategy;
  shouldOfferTryOn: boolean;
  shouldShowLook: boolean;
  shouldShowProduct: boolean;
  shouldPersistState: boolean;
  metadata: Record<string, unknown>;
}
