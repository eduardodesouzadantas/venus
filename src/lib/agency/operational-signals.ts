export interface OperationalSignalEventRow {
  org_id: string | null;
  event_type: string;
  created_at: string | null;
  payload: unknown;
}

export interface OperationalSignalCountRow {
  key: string;
  count: number;
}

export interface OperationalSignalDurationRow extends OperationalSignalCountRow {
  avg_duration_ms: number | null;
  max_duration_ms: number | null;
}

export interface OperationalSignalOrgRow extends OperationalSignalCountRow {
  friction_score: number;
  blocked_count: number;
  conflict_count: number;
  wait_count: number;
  failed_count: number;
  avg_duration_ms: number | null;
  max_duration_ms: number | null;
  top_reason_code: string | null;
  top_event_type: string | null;
}

export interface OperationalSignalSummary {
  total_events: number;
  blocked_count: number;
  conflict_count: number;
  wait_count: number;
  failed_count: number;
  reclaimed_count: number;
  avg_duration_ms: number | null;
  max_duration_ms: number | null;
  top_reason_codes: OperationalSignalCountRow[];
  top_event_types: OperationalSignalDurationRow[];
  top_orgs: OperationalSignalOrgRow[];
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getDurationMs(payload: Record<string, unknown>) {
  const candidates = [
    payload.duration_ms,
    payload.generation_duration_ms,
    payload.persist_duration_ms,
    payload.wait_duration_ms,
  ];

  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getReasonCode(payload: Record<string, unknown>) {
  const reasonCode = normalizeText(payload.reason_code);
  return reasonCode || null;
}

function isBlockedEvent(eventType: string) {
  return eventType.includes("blocked");
}

function isConflictEvent(eventType: string) {
  return eventType.includes("conflict");
}

function isWaitEvent(eventType: string, reasonCode: string | null) {
  return eventType.includes("wait") || eventType.includes("expired_reclaimed") || reasonCode === "single_flight:busy";
}

function isFailedEvent(eventType: string) {
  return eventType.includes("failed");
}

function isReclaimedEvent(eventType: string) {
  return eventType.includes("expired_reclaimed");
}

function pushCount(map: Map<string, number>, key: string, nextValue = 1) {
  map.set(key, (map.get(key) || 0) + nextValue);
}

function pushDuration(
  map: Map<string, { count: number; total: number; max: number | null }>,
  key: string,
  duration: number | null
) {
  const current = map.get(key) || { count: 0, total: 0, max: null as number | null };
  current.count += 1;
  if (duration !== null) {
    current.total += duration;
    current.max = current.max === null ? duration : Math.max(current.max, duration);
  }
  map.set(key, current);
}

function computeAvg(total: number, count: number) {
  if (count <= 0) return null;
  return total / count;
}

function sortCountRows<T extends OperationalSignalCountRow>(rows: T[]) {
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const byCount = right.row.count - left.row.count;
      if (byCount !== 0) return byCount;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function sortDurationRows(rows: OperationalSignalDurationRow[]) {
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const byCount = right.row.count - left.row.count;
      if (byCount !== 0) return byCount;
      const leftMax = left.row.max_duration_ms || 0;
      const rightMax = right.row.max_duration_ms || 0;
      if (rightMax !== leftMax) return rightMax - leftMax;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function sortOrgRows(rows: OperationalSignalOrgRow[]) {
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftScore = left.row.friction_score;
      const rightScore = right.row.friction_score;
      if (rightScore !== leftScore) return rightScore - leftScore;
      const byCount = right.row.count - left.row.count;
      if (byCount !== 0) return byCount;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

export function collectOperationalSignalSummary(
  rows: OperationalSignalEventRow[],
  options?: {
    limit?: number;
  }
): OperationalSignalSummary {
  const limit = options?.limit ?? 5;
  const reasonCounts = new Map<string, number>();
  const eventCounts = new Map<string, number>();
  const eventDurations = new Map<string, { count: number; total: number; max: number | null }>();
  const orgRows = new Map<
    string,
    {
      row: OperationalSignalOrgRow;
      reasonCounts: Map<string, number>;
      eventCounts: Map<string, number>;
      durationCount: number;
      durationTotal: number;
      durationMax: number | null;
    }
  >();

  let totalDurationCount = 0;
  let totalDuration = 0;
  let maxDuration: number | null = null;
  let blocked_count = 0;
  let conflict_count = 0;
  let wait_count = 0;
  let failed_count = 0;
  let reclaimed_count = 0;

  for (const row of rows) {
    const eventType = normalizeText(row.event_type);
    if (!eventType) {
      continue;
    }

    const payload = asRecord(row.payload);
    const reasonCode = getReasonCode(payload);
    const durationMs = getDurationMs(payload);
    const orgId = normalizeText(row.org_id);

    pushCount(eventCounts, eventType);
    if (reasonCode) {
      pushCount(reasonCounts, reasonCode);
    }
    pushDuration(eventDurations, eventType, durationMs);

    if (durationMs !== null) {
      totalDuration += durationMs;
      totalDurationCount += 1;
      maxDuration = maxDuration === null ? durationMs : Math.max(maxDuration, durationMs);
    }

    const blocked = isBlockedEvent(eventType);
    const conflict = isConflictEvent(eventType);
    const wait = isWaitEvent(eventType, reasonCode);
    const failed = isFailedEvent(eventType);
    const reclaimed = isReclaimedEvent(eventType);

    if (blocked) blocked_count += 1;
    if (conflict) conflict_count += 1;
    if (wait) wait_count += 1;
    if (failed) failed_count += 1;
    if (reclaimed) reclaimed_count += 1;

    if (orgId) {
      const current = orgRows.get(orgId) || {
        row: {
          key: orgId,
          count: 0,
          friction_score: 0,
          blocked_count: 0,
          conflict_count: 0,
          wait_count: 0,
          failed_count: 0,
          avg_duration_ms: null,
          max_duration_ms: null,
          top_reason_code: null,
          top_event_type: null,
        },
        reasonCounts: new Map<string, number>(),
        eventCounts: new Map<string, number>(),
        durationCount: 0,
        durationTotal: 0,
        durationMax: null as number | null,
      };

      current.row.count += 1;
      if (blocked) current.row.blocked_count += 1;
      if (conflict) current.row.conflict_count += 1;
      if (wait) current.row.wait_count += 1;
      if (failed) current.row.failed_count += 1;
      current.row.friction_score = current.row.blocked_count + current.row.conflict_count + current.row.wait_count + current.row.failed_count;

      pushCount(current.eventCounts, eventType);
      if (reasonCode) {
        pushCount(current.reasonCounts, reasonCode);
      }

      if (durationMs !== null) {
        current.durationCount += 1;
        current.durationTotal += durationMs;
        current.durationMax = current.durationMax === null ? durationMs : Math.max(current.durationMax, durationMs);
      }

      orgRows.set(orgId, current);
    }
  }

  const reasonRows = sortCountRows(
    [...reasonCounts.entries()].map(([key, count]) => ({ key, count }))
  ).slice(0, limit);

  const eventTypeRows = sortDurationRows(
    [...eventDurations.entries()].map(([key, stats]) => ({
      key,
      count: stats.count,
      avg_duration_ms: stats.count > 0 ? stats.total / stats.count : null,
      max_duration_ms: stats.max,
    }))
  ).slice(0, limit);

  const orgSummaryRows = sortOrgRows(
    [...orgRows.values()].map((entry) => {
      const topReasonEntry = [...entry.reasonCounts.entries()].sort((left, right) => {
        const byCount = right[1] - left[1];
        if (byCount !== 0) return byCount;
        return left[0].localeCompare(right[0]);
      })[0] || null;
      const topEventEntry = [...entry.eventCounts.entries()].sort((left, right) => {
        const byCount = right[1] - left[1];
        if (byCount !== 0) return byCount;
        return left[0].localeCompare(right[0]);
      })[0] || null;

      return {
        ...entry.row,
        avg_duration_ms: computeAvg(entry.durationTotal, entry.durationCount),
        max_duration_ms: entry.durationMax,
        top_reason_code: topReasonEntry ? topReasonEntry[0] : null,
        top_event_type: topEventEntry ? topEventEntry[0] : null,
      };
    })
  ).slice(0, limit);

  return {
    total_events: rows.length,
    blocked_count,
    conflict_count,
    wait_count,
    failed_count,
    reclaimed_count,
    avg_duration_ms: computeAvg(totalDuration, totalDurationCount),
    max_duration_ms: maxDuration,
    top_reason_codes: reasonRows,
    top_event_types: eventTypeRows,
    top_orgs: orgSummaryRows,
  };
}
