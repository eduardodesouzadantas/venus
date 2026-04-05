"use client";

export type WhatsAppTenantToken = {
  access_token: string;
  expires_at: number;
  expires_in: number;
  org_slug: string;
  org_id: string;
  email: string;
  user_id: string;
  token_type: "bearer";
};

const WHATSAPP_TOKEN_PREFIX = "venus_whatsapp_tenant_session";
const REFRESH_SAFETY_WINDOW_SECONDS = 300;

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function resolveCurrentOrgSlug(): string | null {
  if (typeof window === "undefined") return null;

  const parts = window.location.pathname.split("/").filter(Boolean);
  const orgIndex = parts.indexOf("org");

  return orgIndex >= 0 ? parts[orgIndex + 1] || null : null;
}

function tokenStorageKey(orgSlug: string) {
  return `${WHATSAPP_TOKEN_PREFIX}:${orgSlug}`;
}

function decodeJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function readCachedWhatsAppToken(orgSlug: string): WhatsAppTenantToken | null {
  if (typeof window === "undefined") return null;
  return safeParse<WhatsAppTenantToken>(window.localStorage.getItem(tokenStorageKey(orgSlug)));
}

export function clearCachedWhatsAppToken(orgSlug?: string) {
  if (typeof window === "undefined") return;

  if (orgSlug) {
    window.localStorage.removeItem(tokenStorageKey(orgSlug));
    return;
  }

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(WHATSAPP_TOKEN_PREFIX)) {
      keys.push(key);
    }
  }

  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function storeWhatsAppToken(session: WhatsAppTenantToken) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tokenStorageKey(session.org_slug), JSON.stringify(session));
}

function isTokenFresh(session: WhatsAppTenantToken | null) {
  if (!session) return false;
  const remaining = session.expires_at - Math.floor(Date.now() / 1000);
  return remaining > REFRESH_SAFETY_WINDOW_SECONDS;
}

export async function getWhatsAppAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const currentOrgSlug = resolveCurrentOrgSlug();
  if (!currentOrgSlug) {
    return null;
  }

  const cached = readCachedWhatsAppToken(currentOrgSlug);
  if (cached && isTokenFresh(cached)) {
    return cached.access_token;
  }

  const response = await fetch("/api/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    clearCachedWhatsAppToken(currentOrgSlug);
    return null;
  }

  const session = payload as WhatsAppTenantToken;

  const decodedExp = decodeJwtExpiry(session.access_token);
  if (decodedExp && !session.expires_at) {
    session.expires_at = decodedExp;
  }

  storeWhatsAppToken(session);
  return session.access_token;
}
