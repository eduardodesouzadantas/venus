const PRODUCT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeTryOnProductId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidTryOnProductId(value: string | null | undefined): value is string {
  return PRODUCT_UUID_RE.test(normalizeTryOnProductId(value));
}

export function ensureTryOnProductId(value: string | null | undefined): string | null {
  const normalized = normalizeTryOnProductId(value);
  return PRODUCT_UUID_RE.test(normalized) ? normalized : null;
}
