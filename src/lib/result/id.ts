export const RESULT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidResultId(value?: string | null) {
  const normalized = (value || "").trim();
  return Boolean(normalized) && normalized !== "MOCK_DB_FAIL" && RESULT_ID_PATTERN.test(normalized);
}
