type LeadContextSyncInput = {
  orgId?: string | null;
  leadId?: string | null;
  savedResultId?: string | null;
  phone?: string | null;
  email?: string | null;
  eventType?: string | null;
  action?: string | null;
  outcome?: string | null;
  profileData?: Record<string, unknown> | null;
  styleProfile?: Record<string, unknown> | null;
  colorimetry?: Record<string, unknown> | null;
  bodyAnalysis?: Record<string, unknown> | null;
  intentScore?: number | null;
  emotionalState?: Record<string, unknown> | null;
  lastTryon?: Record<string, unknown> | null;
  lastProductsViewed?: unknown[] | null;
  lastRecommendations?: unknown[] | null;
  whatsappContext?: Record<string, unknown> | null;
  lastAction?: string | null;
  lastActionOutcome?: string | null;
  actionHistory?: unknown[] | null;
  eventMeta?: Record<string, unknown> | null;
};

export async function syncLeadContext(input: LeadContextSyncInput) {
  if (!input.orgId) {
    return null;
  }

  try {
    const response = await fetch("/api/lead-context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      keepalive: true,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return null;
    }

    return response.json().catch(() => null);
  } catch {
    return null;
  }
}
