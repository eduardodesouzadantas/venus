import type { ConversationStatus, SmartReplyAngle, SmartReplySuggestion, WhatsAppMessage } from "@/types/whatsapp";

export type ReplyRowAngle = {
  label: string;
  metricAngle: SmartReplyAngle;
  description: string;
};

export const REPLY_ROW_ANGLES: ReplyRowAngle[] = [
  { label: "CLOSING", metricAngle: "closing", description: "Fechamento e proxima decisao" },
  { label: "OBJECTION", metricAngle: "objection", description: "Trava, duvida ou inseguranca" },
  { label: "CURIOSITY", metricAngle: "desire", description: "Aumentar desejo e contexto" },
];

export const STATUS_META: Record<
  ConversationStatus,
  { label: string; badge: string; rail: string }
> = {
  ai_active: {
    label: "AI ACTIVE",
    badge: "border-[#00FF88]/20 bg-[#00FF88]/10 text-[#00FF88]",
    rail: "#00FF88",
  },
  human_required: {
    label: "HUMAN REQUIRED",
    badge: "border-[#FF3B3B]/20 bg-[#FF3B3B]/10 text-[#FF3B3B]",
    rail: "#FF3B3B",
  },
  human_takeover: {
    label: "HUMAN TAKEOVER",
    badge: "border-[#C9A84C]/20 bg-[#C9A84C]/10 text-[#C9A84C]",
    rail: "#C9A84C",
  },
  resolved: {
    label: "RESOLVED",
    badge: "border-white/10 bg-white/5 text-white/35",
    rail: "#666666",
  },
  follow_up: {
    label: "FOLLOW UP",
    badge: "border-white/10 bg-white/5 text-white/55",
    rail: "#8a6f2e",
  },
};

type MessageStyleMeta = {
  label: string;
  labelClass: string;
  bubbleClass: string;
  borderClass: string;
  alignClass: string;
};

export const MESSAGE_STYLE_META: Record<string, MessageStyleMeta> = {
  user: {
    label: "CLIENTE",
    labelClass: "text-[#555]",
    bubbleClass: "bg-[#141414] text-[#E0E0E0]",
    borderClass: "border-l-[#333]",
    alignClass: "items-start",
  },
  ai: {
    label: "VENUS",
    labelClass: "text-[#00FF88]",
    bubbleClass: "bg-[#0d1f0d] text-[#ccffcc]",
    borderClass: "border-l-[#00FF88]",
    alignClass: "items-end",
  },
  venus: {
    label: "VENUS",
    labelClass: "text-[#00FF88]",
    bubbleClass: "bg-[#0d1f0d] text-[#ccffcc]",
    borderClass: "border-l-[#00FF88]",
    alignClass: "items-end",
  },
  merchant: {
    label: "VOCÊ",
    labelClass: "text-[#C9A84C]",
    bubbleClass: "bg-[#1f1800] text-[#fff8dc]",
    borderClass: "border-l-[#C9A84C]",
    alignClass: "items-end",
  },
  agent: {
    label: "VOCÊ",
    labelClass: "text-[#C9A84C]",
    bubbleClass: "bg-[#1a160a] text-[#FFF8E8]",
    borderClass: "border-l-[#C9A84C]",
    alignClass: "items-end",
  },
};

const isDecorativePreview = (value: string) => /^[\s✦*•·-]+$/.test(value);

const AVATAR_PALETTES = [
  ["#141414", "#251f11"],
  ["#111111", "#312817"],
  ["#101010", "#2a2010"],
  ["#161616", "#1f1a0a"],
  ["#121212", "#302618"],
  ["#151515", "#282218"],
  ["#131313", "#3a2e17"],
  ["#0f0f0f", "#28230f"],
];

export const formatShortTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const formatCompactNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
};

export const toTitleCase = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getAvatarStyle = (value: string) => {
  const palette = AVATAR_PALETTES[hashString(value) % AVATAR_PALETTES.length];
  return {
    background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
  };
};

export const getConversationStatusMeta = (status: ConversationStatus) => STATUS_META[status];

export const getConversationPreview = (conversation: {
  lastMessage: string;
  messages: WhatsAppMessage[];
}) => {
  const latestRealMessage = [...conversation.messages]
    .reverse()
    .map((message) => message.text.trim())
    .find((text) => Boolean(text) && !isDecorativePreview(text));

  if (latestRealMessage) return latestRealMessage;
  if (conversation.lastMessage && !isDecorativePreview(conversation.lastMessage.trim())) return conversation.lastMessage;
  return latestRealMessage || conversation.lastMessage || "";
};

export function groupMessages(messages: WhatsAppMessage[]) {
  const groups: Array<{ sender: WhatsAppMessage["sender"]; messages: WhatsAppMessage[] }> = [];

  for (const message of messages) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.sender === message.sender) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ sender: message.sender, messages: [message] });
    }
  }

  return groups;
}
