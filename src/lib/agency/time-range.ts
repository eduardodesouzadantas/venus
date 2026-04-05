import "server-only";

export type AgencyTimeRange = "7d" | "30d" | "90d" | "all";

export interface AgencyTimeRangeWindow {
  range: AgencyTimeRange;
  dateFrom: string | null;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toUtcDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function subtractDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

export function normalizeAgencyTimeRange(value: unknown, fallback: AgencyTimeRange = "all"): AgencyTimeRange {
  const normalized = normalize(value);
  if (normalized === "7d" || normalized === "30d" || normalized === "90d" || normalized === "all") {
    return normalized;
  }
  return fallback;
}

export function resolveAgencyTimeRangeWindow(
  range: AgencyTimeRange = "all",
  referenceDate = new Date()
): AgencyTimeRangeWindow {
  if (range === "all") {
    return {
      range,
      dateFrom: null,
    };
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const dateFrom = toUtcDateString(subtractDays(referenceDate, Math.max(days - 1, 0)));

  return {
    range,
    dateFrom,
  };
}

