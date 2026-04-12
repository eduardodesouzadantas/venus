import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  whatsapp_key: string | null;
  status: string | null;
  saved_result_id: string | null;
  intent_score: number | null;
  created_at: string | null;
  updated_at: string | null;
  last_interaction_at: string | null;
};

type SavedResultRow = {
  id: string;
  payload: Record<string, unknown> | null;
};

type SignalItem = {
  phone: string;
  name: string;
  lastAction: string;
  minutesAgo: number;
  recommendedAction: string;
  lookInterested: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLower(value: unknown) {
  return normalize(value).toLowerCase();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getLastActionAt(lead: LeadRow) {
  const value = lead.last_interaction_at || lead.updated_at || lead.created_at || null;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getMinutesAgo(timestamp: number) {
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function getLookInterest(payload: Record<string, unknown> | null) {
  if (!payload) return "";
  const finalResult = asRecord(payload.finalResult);
  const handoff = asRecord(payload.whatsappHandoff);
  const looks =
    (Array.isArray(finalResult?.looks) ? (finalResult?.looks as Array<Record<string, unknown>>) : []) ||
    (Array.isArray(handoff?.lookSummary) ? (handoff?.lookSummary as Array<Record<string, unknown>>) : []);
  const firstLook = looks[0];

  return (
    normalize(firstLook?.name) ||
    normalize(firstLook?.title) ||
    normalize((payload as Record<string, unknown>).productName) ||
    normalize((payload as Record<string, unknown>).lookName) ||
    "Curadoria Venus"
  );
}

export async function GET(req: NextRequest) {
  const orgId = normalize(req.nextUrl.searchParams.get("orgId") || req.nextUrl.searchParams.get("org_id"));
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [leadsResult, savedResultsResult] = await Promise.all([
    admin
      .from("leads")
      .select("id, name, phone, whatsapp_key, status, saved_result_id, intent_score, created_at, updated_at, last_interaction_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(500),
    admin
      .from("saved_results")
      .select("id, payload")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (leadsResult.error) {
    return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  }
  if (savedResultsResult.error) {
    return NextResponse.json({ error: savedResultsResult.error.message }, { status: 500 });
  }

  const leads = (leadsResult.data || []) as LeadRow[];
  const savedResults = (savedResultsResult.data || []) as SavedResultRow[];
  const payloadById = new Map(savedResults.map((row) => [row.id, row.payload]));
  const phones = new Map<string, { lead: LeadRow; countWon: number; payload: Record<string, unknown> | null }>();

  for (const lead of leads) {
    const phone = normalize(lead.phone || lead.whatsapp_key);
    if (!phone) continue;
    const current = phones.get(phone);
    const payload = lead.saved_result_id ? payloadById.get(lead.saved_result_id) || null : null;

    if (!current) {
      phones.set(phone, { lead, countWon: normalizeLower(lead.status) === "won" ? 1 : 0, payload });
      continue;
    }

    const currentTime = getLastActionAt(current.lead);
    const nextTime = getLastActionAt(lead);
    if (nextTime >= currentTime) {
      phones.set(phone, {
        lead,
        countWon: current.countWon + (normalizeLower(lead.status) === "won" ? 1 : 0),
        payload: payload || current.payload,
      });
    } else {
      current.countWon += normalizeLower(lead.status) === "won" ? 1 : 0;
      current.payload = current.payload || payload;
    }
  }

  const items = Array.from(phones.entries()).map(([phone, entry]) => {
    const lead = entry.lead;
    const minutesAgo = getMinutesAgo(getLastActionAt(lead));
    const lookInterested = getLookInterest(entry.payload);
    const status = normalizeLower(lead.status);

    let bucket: "hot" | "warm" | "cold" | "vip" = "warm";
    let recommendedAction = "Contatar via Venus";
    let lastAction = "Interação registrada";

    if (entry.countWon >= 5 && minutesAgo >= 14 * 24 * 60) {
      bucket = "vip";
      recommendedAction = "Contato VIP via Venus";
      lastAction = "Histórico de compras forte";
    } else if (minutesAgo <= 10 && status !== "won" && status !== "lost") {
      bucket = "hot";
      recommendedAction = "Responder agora";
      lastAction = "Try-on ou interação recente";
    } else if ((status === "engaged" || status === "qualified" || (lead.intent_score ?? 0) >= 60) && minutesAgo <= 3 * 24 * 60) {
      bucket = "warm";
      recommendedAction = "Reforçar curadoria";
      lastAction = "Engajamento em andamento";
    } else if (minutesAgo >= 7 * 24 * 60) {
      bucket = "cold";
      recommendedAction = "Reativar com elegância";
      lastAction = "Cliente silencioso";
    }

    return {
      bucket,
      item: {
        phone,
        name: normalize(lead.name) || "Cliente Venus",
        lastAction,
        minutesAgo,
        recommendedAction,
        lookInterested,
      } satisfies SignalItem,
    };
  });

  const buckets = {
    hot: items.filter((entry) => entry.bucket === "hot").map((entry) => entry.item).sort((left, right) => left.minutesAgo - right.minutesAgo),
    warm: items.filter((entry) => entry.bucket === "warm").map((entry) => entry.item).sort((left, right) => left.minutesAgo - right.minutesAgo),
    cold: items.filter((entry) => entry.bucket === "cold").map((entry) => entry.item).sort((left, right) => right.minutesAgo - left.minutesAgo),
    vip: items.filter((entry) => entry.bucket === "vip").map((entry) => entry.item).sort((left, right) => right.minutesAgo - left.minutesAgo),
  };

  return NextResponse.json({
    ok: true,
    orgId,
    ...buckets,
  });
}
