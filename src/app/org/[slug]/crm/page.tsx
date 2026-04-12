import Link from "next/link";
import { redirect } from "next/navigation";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isMerchantRole, resolveTenantContext } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type LeadRow = {
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
  if (!payload) return "Curadoria Venus";
  const finalResult = asRecord(payload.finalResult);
  const handoff = asRecord(payload.whatsappHandoff);
  const firstLook = Array.isArray(finalResult?.looks) ? (finalResult?.looks as Array<Record<string, unknown>>)[0] : null;
  const handoffLook = Array.isArray(handoff?.lookSummary) ? (handoff?.lookSummary as Array<Record<string, unknown>>)[0] : null;

  return normalize(firstLook?.name) || normalize(handoffLook?.name) || normalize((payload as Record<string, unknown>).productName) || "Curadoria Venus";
}

function buildRecommendedAction(bucket: "hot" | "warm" | "cold" | "vip") {
  if (bucket === "hot") return "Responder via Venus";
  if (bucket === "warm") return "Reforçar curadoria";
  if (bucket === "vip") return "Contato VIP";
  return "Reativar com elegância";
}

function buildLastAction(bucket: "hot" | "warm" | "cold" | "vip") {
  if (bucket === "hot") return "Interação recente";
  if (bucket === "warm") return "Engajamento em andamento";
  if (bucket === "vip") return "Cliente recorrente";
  return "Cliente silencioso";
}

async function loadSignals(orgId: string) {
  const admin = createAdminClient();
  const [leadsResult, savedResultsResult] = await Promise.all([
    admin
      .from("leads")
      .select("name, phone, whatsapp_key, status, saved_result_id, intent_score, created_at, updated_at, last_interaction_at")
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

  if (leadsResult.error) throw leadsResult.error;
  if (savedResultsResult.error) throw savedResultsResult.error;

  const leads = (leadsResult.data || []) as LeadRow[];
  const savedResults = (savedResultsResult.data || []) as SavedResultRow[];
  const payloadById = new Map(savedResults.map((row) => [row.id, row.payload]));
  const phones = new Map<string, { lead: LeadRow; countWon: number; payload: Record<string, unknown> | null }>();

  for (const lead of leads) {
    const phone = normalize(lead.phone || lead.whatsapp_key);
    if (!phone) continue;
    const payload = lead.saved_result_id ? payloadById.get(lead.saved_result_id) || null : null;
    const current = phones.get(phone);

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
    const minutesAgo = getMinutesAgo(getLastActionAt(entry.lead));
    const status = normalizeLower(entry.lead.status);
    let bucket: "hot" | "warm" | "cold" | "vip" = "warm";

    if (entry.countWon >= 5 && minutesAgo >= 14 * 24 * 60) {
      bucket = "vip";
    } else if (minutesAgo <= 10 && status !== "won" && status !== "lost") {
      bucket = "hot";
    } else if ((status === "engaged" || status === "qualified" || (entry.lead.intent_score ?? 0) >= 60) && minutesAgo <= 3 * 24 * 60) {
      bucket = "warm";
    } else if (minutesAgo >= 7 * 24 * 60) {
      bucket = "cold";
    }

    return {
      bucket,
      item: {
        phone,
        name: normalize(entry.lead.name) || "Cliente Venus",
        lastAction: buildLastAction(bucket),
        minutesAgo,
        recommendedAction: buildRecommendedAction(bucket),
        lookInterested: getLookInterest(entry.payload),
      } satisfies SignalItem,
    };
  });

  return {
    hot: items.filter((entry) => entry.bucket === "hot").map((entry) => entry.item).sort((left, right) => left.minutesAgo - right.minutesAgo),
    warm: items.filter((entry) => entry.bucket === "warm").map((entry) => entry.item).sort((left, right) => left.minutesAgo - right.minutesAgo),
    cold: items.filter((entry) => entry.bucket === "cold").map((entry) => entry.item).sort((left, right) => right.minutesAgo - left.minutesAgo),
    vip: items.filter((entry) => entry.bucket === "vip").map((entry) => entry.item).sort((left, right) => right.minutesAgo - left.minutesAgo),
  };
}

function BucketColumn({ title, items, tone }: { title: string; items: SignalItem[]; tone: "hot" | "warm" | "cold" | "vip" }) {
  const ring = tone === "hot" ? "border-red-500/20 bg-red-500/8" : tone === "warm" ? "border-amber-500/20 bg-amber-500/8" : tone === "cold" ? "border-slate-500/20 bg-slate-500/8" : "border-[#C9A84C]/20 bg-[#C9A84C]/8";

  return (
    <div className={`rounded-[28px] border p-5 ${ring}`}>
      <div className="flex items-center justify-between gap-3">
        <Heading as="h3" className="text-lg uppercase tracking-tight">
          {title}
        </Heading>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.phone} className="rounded-[22px] border border-white/5 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/35">{item.phone}</p>
                </div>
                <span className="text-[9px] uppercase tracking-[0.26em] text-white/35">{item.minutesAgo} min</span>
              </div>
              <p className="mt-3 text-sm text-white/65">{item.lookInterested}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[9px] uppercase tracking-[0.26em] text-white/35">{item.lastAction}</span>
                <Link
                  href={`https://wa.me/${item.phone}?text=${encodeURIComponent(`Oi, ${item.name}! A Venus viu sua presença e quer continuar a conversa.`)}`}
                  target="_blank"
                  className="rounded-full border border-[#C9A84C]/30 bg-[#C9A84C] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.26em] text-black"
                >
                  Contatar via Venus
                </Link>
              </div>
            </div>
          ))
        ) : (
          <Text className="text-sm text-white/45">Nenhum sinal nesse grupo.</Text>
        )}
      </div>
    </div>
  );
}

export default async function CRMPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = resolveTenantContext(user);
  if (context.role && isMerchantRole(context.role) && context.orgSlug !== slug) {
    redirect("/merchant");
  }
  if (!context.role || (!isAgencyRole(context.role) && context.orgSlug !== slug)) {
    redirect("/login");
  }

  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org) {
    redirect("/merchant");
  }

  const signals = await loadSignals(org.id).catch(() => ({ hot: [], warm: [], cold: [], vip: [] }));

  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <Text className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#C9A84C]">CRM Venus</Text>
          <Heading as="h1" className="text-3xl uppercase tracking-tighter">
            Sinais por urgência
          </Heading>
          <Text className="max-w-2xl text-sm text-white/50">
            Quente, morno, frio e VIP organizados para ação imediata da Venus.
          </Text>
        </header>

        <div className="grid gap-4 lg:grid-cols-4">
          <BucketColumn title="Quente" items={signals.hot} tone="hot" />
          <BucketColumn title="Morno" items={signals.warm} tone="warm" />
          <BucketColumn title="Frio" items={signals.cold} tone="cold" />
          <BucketColumn title="VIP" items={signals.vip} tone="vip" />
        </div>

        <div className="flex gap-3">
          <Link href={`/org/${slug}/dashboard`}>
            <VenusButton variant="outline" className="border-white/10">
              Voltar ao dashboard
            </VenusButton>
          </Link>
          <Link href={`/org/${slug}/whatsapp/campaigns`}>
            <VenusButton variant="solid" className="bg-[#C9A84C] text-black">
              Criar campanha
            </VenusButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
