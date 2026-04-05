export type ConversationStatus = 'ai_active' | 'human_required' | 'human_takeover' | 'resolved' | 'follow_up';
export type MessageSender = 'user' | 'ai' | 'merchant';
export type PriorityLevel = 'low' | 'medium' | 'high';

export interface WhatsAppMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
  type: 'text' | 'product_link' | 'bundle_push' | 'try_on_result';
  orgSlug?: string;
  metadata?: any;
}

export interface UserContext {
  name: string;
  phone: string;
  styleIdentity: string;
  intentScore: number;
  viewedProducts: string[];
  lastLookId: string;
  tryOnCount: number;
  orgSlug?: string;
  imageGoal?: string;
  paletteFamily?: string;
  fit?: string;
  metal?: string;
  source?: "manual" | "handoff" | "automation" | "saved_result";
  lastHandoffId?: string;
  lookSummary?: Array<{
    id: string;
    name: string;
    intention: string;
    type: string;
    explanation: string;
    whenToWear: string;
  }>;
}

export interface WhatsAppConversation {
  id: string;
  orgSlug: string;
  status: ConversationStatus;
  priority: PriorityLevel;
  lastMessage: string;
  lastUpdated: string;
  unreadCount: number;
  user: UserContext;
  messages: WhatsAppMessage[];
}

// Smart Replies Types
export type SmartReplyAngle = 'closing' | 'objection' | 'desire' | 'price' | 'fit';

export type SmartReplySuggestion = {
  id: string;
  label: string;
  angle: SmartReplyAngle;
  text: string;
  recommendedFor?: string;
  confidence?: number;
};

export type CampaignObjective =
  | 'novidades'
  | 'recompra'
  | 'look_da_semana'
  | 'recuperar_inativo'
  | 'cross_sell'
  | 'pos_compra';

export type AudienceSegment =
  | 'inativos'
  | 'alta_intencao'
  | 'try_on_users'
  | 'bundle_buyers'
  | 'high_ticket';

export interface WhatsAppCampaignMessage {
  headline: string;
  body: string;
  cta: string;
  tone: 'premium' | 'elegant' | 'persuasive' | 'concise';
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  segment: AudienceSegment;
  status: 'draft' | 'scheduled' | 'sent';
  message: WhatsAppCampaignMessage;
  metrics?: {
    recipients: number;
    clicks: number;
    responses: number;
    repurchases: number;
  };
  createdAt?: string;
  lastSentAt?: string;
}
