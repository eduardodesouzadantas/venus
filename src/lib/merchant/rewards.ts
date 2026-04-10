export const MERCHANT_REWARD_TYPES = [
  "discount_percent",
  "discount_fixed",
  "free_shipping",
  "extra_tryon",
  "early_access",
] as const;

export type MerchantRewardType = (typeof MERCHANT_REWARD_TYPES)[number];

export interface MerchantRewardRecord {
  id: string;
  org_id: string;
  type: MerchantRewardType;
  value: number | null;
  label: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

const REWARD_TYPE_SET = new Set<MerchantRewardType>(MERCHANT_REWARD_TYPES);

export function normalizeRewardType(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return REWARD_TYPE_SET.has(raw as MerchantRewardType) ? (raw as MerchantRewardType) : null;
}

export function rewardTypeLabel(type: MerchantRewardType) {
  switch (type) {
    case "discount_percent":
      return "Desconto percentual";
    case "discount_fixed":
      return "Desconto fixo";
    case "free_shipping":
      return "Frete gratis";
    case "extra_tryon":
      return "Try-on extra";
    case "early_access":
      return "Acesso antecipado";
  }
}

export function rewardTypeNeedsValue(type: MerchantRewardType) {
  return type === "discount_percent" || type === "discount_fixed";
}

export function normalizeRewardValue(type: MerchantRewardType, value: unknown) {
  if (!rewardTypeNeedsValue(type)) {
    return null;
  }

  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRewardExpiresAt(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
