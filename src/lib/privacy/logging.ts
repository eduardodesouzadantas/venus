export type PrivacyLogValue = string | number | boolean | null | undefined | PrivacyLogValue[] | { [key: string]: PrivacyLogValue };

const SENSITIVE_KEY_PARTS = [
  "email",
  "phone",
  "mobile",
  "name",
  "token",
  "secret",
  "password",
  "authorization",
  "cookie",
  "session",
  "image",
  "photo",
  "url",
  "payload",
  "body",
  "message",
  "text",
  "raw",
  "base64",
  "signed",
  "contact",
  "cpf",
  "cnpj",
  "card",
  "address",
  "birthdate",
  "birth_day",
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

export function maskPhone(value: unknown) {
  const digits = normalizeText(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return `***${digits}`;
  return `***${digits.slice(-4)}`;
}

export function maskEmail(value: unknown) {
  const email = normalizeText(value).toLowerCase();
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "";

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const head = local.slice(0, 1) || "*";
  return `${head}***@${domain}`;
}

export function stripUrlQuery(value: unknown) {
  const url = normalizeText(value);
  if (!url) return "";

  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0].split("#")[0];
  }
}

function isSensitiveKey(key: string) {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
}

function sanitizeString(key: string, value: string) {
  if (!value) return value;

  if (key === "email" || key.endsWith("email")) {
    return maskEmail(value) || "[REDACTED]";
  }

  if (key === "phone" || key.endsWith("phone") || key.includes("phone")) {
    return maskPhone(value) || "[REDACTED]";
  }

  if (key.includes("signed") || key.includes("base64") || key.includes("raw")) {
    return "[REDACTED]";
  }

  if (key === "url" || key.endsWith("url") || key.includes("image")) {
    return stripUrlQuery(value) || "[REDACTED]";
  }

  if (isSensitiveKey(key)) {
    return "[REDACTED]";
  }

  if (value.length > 180) {
    return `${value.slice(0, 177)}...`;
  }

  return value;
}

export function sanitizePrivacyLogValue(value: PrivacyLogValue, depth = 0, key = ""): PrivacyLogValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(key, value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return "[REDACTED]" as PrivacyLogValue;
    }

    return value.slice(0, 10).map((item) => sanitizePrivacyLogValue(item, depth + 1, key));
  }

  if (depth >= 2) {
    return "[REDACTED]" as PrivacyLogValue;
  }

  const next: Record<string, PrivacyLogValue> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.toLowerCase().includes("email")) {
      next[entryKey] = maskEmail(entryValue);
      continue;
    }

    if (entryKey.toLowerCase().includes("phone")) {
      next[entryKey] = maskPhone(entryValue);
      continue;
    }

    if (entryKey.toLowerCase().includes("signed") || entryKey.toLowerCase().includes("base64") || entryKey.toLowerCase().includes("raw")) {
      next[entryKey] =
        typeof entryValue === "boolean" || typeof entryValue === "number"
          ? entryValue
          : "[REDACTED]";
      continue;
    }

    if (entryKey.toLowerCase().includes("url") || entryKey.toLowerCase().includes("image")) {
      next[entryKey] =
        typeof entryValue === "boolean" || typeof entryValue === "number"
          ? entryValue
          : stripUrlQuery(entryValue);
      continue;
    }

    if (isSensitiveKey(entryKey)) {
      next[entryKey] =
        typeof entryValue === "boolean" || typeof entryValue === "number"
          ? entryValue
          : "[REDACTED]";
      continue;
    }

    next[entryKey] = sanitizePrivacyLogValue(entryValue as PrivacyLogValue, depth + 1, entryKey);
  }

  return next;
}

export function sanitizePrivacyLogEntry<T extends Record<string, unknown>>(entry: T): T {
  return sanitizePrivacyLogValue(entry as PrivacyLogValue) as T;
}

export function summarizeCountMap(counts: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([, count]) => Number.isFinite(count) && count > 0)
      .map(([key, count]) => [key, count])
  );
}

export function maskCPF(value: unknown) {
  const digits = normalizeText(value).replace(/\D/g, "");
  if (!digits || digits.length !== 11) return "";
  return `***.***.${digits.slice(-3)}-${digits.slice(-2)}`;
}

export function maskCNPJ(value: unknown) {
  const digits = normalizeText(value).replace(/\D/g, "");
  if (!digits || digits.length !== 14) return "";
  return `**.***.${digits.slice(2, 5)}/0001-**`;
}

export function maskCreditCard(value: unknown) {
  const digits = normalizeText(value).replace(/\D/g, "");
  if (!digits || digits.length < 13 || digits.length > 19) return "";
  return `**** **** **** ${digits.slice(-4)}`;
}

export function maskAddress(value: unknown) {
  const address = normalizeText(value);
  if (!address) return "";
  const parts = address.split(",");
  if (parts.length > 1) {
    return `${parts[0].trim()}, ***`;
  }
  if (address.length > 20) {
    return `${address.slice(0, 17)}...`;
  }
  return address;
}
