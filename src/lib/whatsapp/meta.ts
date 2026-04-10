import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetaWhatsAppIntegrationRecord = {
  id: string;
  org_id: string;
  phone_number_id: string;
  business_account_id: string;
  display_phone_number: string | null;
  connected_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MetaWhatsAppConnectionInput = {
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
};

export type MetaWhatsAppConnectionValidation = {
  businessAccountName: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  metaUserId: string | null;
  metaUserName: string | null;
};

export type MetaWhatsAppSendInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
  previewUrl?: boolean;
};

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_INTEGRATION_SECRET = process.env.META_WHATSAPP_INTEGRATION_SECRET?.trim() || "";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireIntegrationSecret() {
  if (!META_INTEGRATION_SECRET) {
    throw new Error("META_WHATSAPP_INTEGRATION_SECRET missing");
  }

  return crypto.createHash("sha256").update(META_INTEGRATION_SECRET).digest();
}

function encodeBase64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function encryptMetaToken(accessToken: string) {
  const secret = requireIntegrationSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
  const encrypted = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${encodeBase64Url(iv)}.${encodeBase64Url(authTag)}.${encodeBase64Url(encrypted)}`;
}

export function decryptMetaToken(value: string) {
  const token = normalize(value);
  if (!token) return "";

  if (!token.startsWith("v1:")) {
    return token;
  }

  const secret = requireIntegrationSecret();
  const payload = token.slice(3);
  const [ivPart, authPart, encryptedPart] = payload.split(".");

  if (!ivPart || !authPart || !encryptedPart) {
    throw new Error("Invalid encrypted Meta token");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", secret, decodeBase64Url(ivPart));
  decipher.setAuthTag(decodeBase64Url(authPart));

  const decrypted = Buffer.concat([
    decipher.update(decodeBase64Url(encryptedPart)),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

async function metaGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${META_GRAPH_BASE_URL}/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Meta API error (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function validateMetaWhatsAppConnection(input: MetaWhatsAppConnectionInput): Promise<MetaWhatsAppConnectionValidation> {
  const accessToken = normalize(input.accessToken);
  const businessAccountId = normalize(input.businessAccountId);
  const phoneNumberId = normalize(input.phoneNumberId);

  if (!accessToken || !businessAccountId || !phoneNumberId) {
    throw new Error("Missing Meta WhatsApp connection data");
  }

  const [metaUser, phoneNumber, businessAccount] = await Promise.all([
    metaGet<{ id?: string; name?: string }>("me", accessToken),
    metaGet<{ display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
      `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      accessToken
    ),
    metaGet<{ name?: string }>(`${businessAccountId}?fields=name`, accessToken),
  ]);

  return {
    businessAccountName: normalize(businessAccount.name) || null,
    displayPhoneNumber: normalize(phoneNumber.display_phone_number) || null,
    verifiedName: normalize(phoneNumber.verified_name) || null,
    qualityRating: normalize(phoneNumber.quality_rating) || null,
    metaUserId: normalize(metaUser.id) || null,
    metaUserName: normalize(metaUser.name) || null,
  };
}

export async function sendMetaWhatsAppTextMessage(input: MetaWhatsAppSendInput) {
  const accessToken = normalize(input.accessToken);
  const phoneNumberId = normalize(input.phoneNumberId);
  const to = normalize(input.to);
  const text = normalize(input.text);

  if (!accessToken || !phoneNumberId || !to || !text) {
    throw new Error("Missing Meta WhatsApp message data");
  }

  const response = await fetch(`${META_GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: Boolean(input.previewUrl),
        body: text,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Meta API error (${response.status})`;
    throw new Error(message);
  }

  return payload as { messages?: Array<{ id?: string }> };
}

export async function loadMetaIntegrationByOrgId(
  supabase: SupabaseClient,
  orgId: string
) {
  const { data, error } = await supabase
    .from("whatsapp_meta_integrations")
    .select(
      "id, org_id, phone_number_id, business_account_id, access_token_encrypted, display_phone_number, verified_name, quality_rating, connected_at, last_verified_at, created_at, updated_at"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as MetaWhatsAppIntegrationRecord | null) || null;
}

export async function loadMetaIntegrationByPhoneNumberId(
  supabase: SupabaseClient,
  phoneNumberId: string
) {
  const { data, error } = await supabase
    .from("whatsapp_meta_integrations")
    .select(
      "id, org_id, phone_number_id, business_account_id, display_phone_number, connected_at, created_at, updated_at"
    )
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as MetaWhatsAppIntegrationRecord | null) || null;
}

export function decryptStoredMetaIntegrationToken(record: { access_token_encrypted: string }) {
  return decryptMetaToken(record.access_token_encrypted);
}
