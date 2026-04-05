import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";
import { SmartReplyAngle, SmartReplySuggestion } from "@/types/whatsapp";

const supabase = createWhatsAppClient();
const MIN_SAMPLE_SIZE = 3;

type SmartReplyMetricsRow = {
  smart_reply_angle: string | null;
  total_sent: number | null;
  total_applied: number | null;
};

type SmartReplyContinuationRow = {
  smart_reply_angle: string | null;
  total_replies: number | null;
};

export interface SmartReplyAnglePerformance {
  angle: SmartReplyAngle;
  totalSent: number;
  totalApplied: number;
  totalReplies: number;
  sentRate: number;
  customerReplyRate: number;
}

export interface SmartReplyOrgRanking {
  orgSlug: string;
  hasData: boolean;
  bestAngle: SmartReplyAngle | null;
  rankedAngles: SmartReplyAnglePerformance[];
}

const isSmartReplyAngle = (value: string | null): value is SmartReplyAngle => {
  return value === "closing" || value === "objection" || value === "desire" || value === "price" || value === "fit";
};

const toNumber = (value: number | null | undefined) => value ?? 0;

const aggregateByAngle = (
  metricsRows: SmartReplyMetricsRow[],
  continuationRows: SmartReplyContinuationRow[]
) => {
  const byAngle = new Map<SmartReplyAngle, SmartReplyAnglePerformance>();

  const ensureAngle = (angle: SmartReplyAngle) => {
    const existing = byAngle.get(angle);
    if (existing) return existing;

    const created: SmartReplyAnglePerformance = {
      angle,
      totalSent: 0,
      totalApplied: 0,
      totalReplies: 0,
      sentRate: 0,
      customerReplyRate: 0,
    };

    byAngle.set(angle, created);
    return created;
  };

  for (const row of metricsRows) {
    if (!isSmartReplyAngle(row.smart_reply_angle)) continue;
    const current = ensureAngle(row.smart_reply_angle);
    current.totalSent += toNumber(row.total_sent);
    current.totalApplied += toNumber(row.total_applied);
  }

  for (const row of continuationRows) {
    if (!isSmartReplyAngle(row.smart_reply_angle)) continue;
    const current = ensureAngle(row.smart_reply_angle);
    current.totalReplies += toNumber(row.total_replies);
  }

  for (const item of byAngle.values()) {
    item.sentRate = item.totalApplied > 0 ? (item.totalSent / item.totalApplied) * 100 : 0;
    item.customerReplyRate = item.totalSent > 0 ? (item.totalReplies / item.totalSent) * 100 : 0;
  }

  return Array.from(byAngle.values());
};

const comparePerformance = (left: SmartReplyAnglePerformance, right: SmartReplyAnglePerformance) => {
  if (right.customerReplyRate !== left.customerReplyRate) {
    return right.customerReplyRate - left.customerReplyRate;
  }

  if (right.sentRate !== left.sentRate) {
    return right.sentRate - left.sentRate;
  }

  if (right.totalSent !== left.totalSent) {
    return right.totalSent - left.totalSent;
  }

  if (right.totalReplies !== left.totalReplies) {
    return right.totalReplies - left.totalReplies;
  }

  return left.angle.localeCompare(right.angle);
};

export async function fetchSmartReplyOrgRanking(orgSlug: string): Promise<SmartReplyOrgRanking | null> {
  if (!orgSlug) return null;

  const [metricsResult, continuationResult] = await Promise.all([
    supabase
      .from("whatsapp_smart_reply_metrics")
      .select("smart_reply_angle,total_sent,total_applied")
      .eq("org_slug", orgSlug),
    supabase
      .from("whatsapp_continuation_view")
      .select("smart_reply_angle,total_replies")
      .eq("org_slug", orgSlug),
  ]);

  if (metricsResult.error) {
    console.warn("[WHATSAPP_RANKING] failed to load metrics view", metricsResult.error);
    return null;
  }

  if (continuationResult.error) {
    console.warn("[WHATSAPP_RANKING] failed to load continuation view", continuationResult.error);
    return null;
  }

  const rankedAngles = aggregateByAngle(
    (metricsResult.data ?? []) as SmartReplyMetricsRow[],
    (continuationResult.data ?? []) as SmartReplyContinuationRow[]
  )
    .filter((item) => item.totalSent >= MIN_SAMPLE_SIZE)
    .sort(comparePerformance);

  return {
    orgSlug,
    hasData: rankedAngles.length > 0,
    bestAngle: rankedAngles[0]?.angle ?? null,
    rankedAngles,
  };
}

export function sortSmartRepliesByOrgRanking(
  replies: SmartReplySuggestion[],
  ranking: SmartReplyOrgRanking | null
) {
  if (!ranking?.hasData || ranking.rankedAngles.length === 0) {
    return replies;
  }

  const rankedAngles = new Map(
    ranking.rankedAngles.map((item, index) => [item.angle, index] as const)
  );
  const originalOrder = new Map(
    replies.map((reply, index) => [reply.angle, index] as const)
  );

  return [...replies].sort((left, right) => {
    const leftRank = rankedAngles.has(left.angle) ? rankedAngles.get(left.angle) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
    const rightRank = rankedAngles.has(right.angle) ? rankedAngles.get(right.angle) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

    const leftEligible = Number.isFinite(leftRank);
    const rightEligible = Number.isFinite(rightRank);

    if (leftEligible && rightEligible) {
      if (leftRank !== rightRank) return leftRank - rightRank;
    } else if (leftEligible !== rightEligible) {
      return leftEligible ? -1 : 1;
    }

    return (originalOrder.get(left.angle) ?? 0) - (originalOrder.get(right.angle) ?? 0);
  });
}
