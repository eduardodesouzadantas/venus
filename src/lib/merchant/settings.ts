import "server-only";

export interface MerchantStoreSettings {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  whatsapp_number: string | null;
  plan_id: string | null;
  status: string;
}

export interface MerchantSettingsPayload {
  name: string;
  logo_url: string | null;
  primary_color: string;
  whatsapp_number: string;
}

const DEFAULT_PRIMARY_COLOR = "#D4AF37";

export function normalizePrimaryColor(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : DEFAULT_PRIMARY_COLOR;
}

export function normalizeWhatsAppNumber(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[^0-9+]/g, "") : "";
}

export function normalizeStoreName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildMerchantSettingsPayload(input: {
  name?: unknown;
  logo_url?: unknown;
  primary_color?: unknown;
  whatsapp_number?: unknown;
}): MerchantSettingsPayload {
  return {
    name: normalizeStoreName(input.name),
    logo_url: typeof input.logo_url === "string" && input.logo_url.trim() ? input.logo_url.trim() : null,
    primary_color: normalizePrimaryColor(input.primary_color),
    whatsapp_number: normalizeWhatsAppNumber(input.whatsapp_number),
  };
}

export async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
