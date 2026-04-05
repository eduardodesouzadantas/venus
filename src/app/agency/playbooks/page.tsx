import Link from "next/link";
import { redirect } from "next/navigation";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, isMerchantRole, resolveTenantContext } from "@/lib/tenant/core";
import { listAgencyOrgRows } from "@/lib/agency";
import { normalizeAgencyTimeRange, type AgencyTimeRange } from "@/lib/agency/time-range";
import {
  getPlaybookQueueSummary,
  listPlaybookQueueItems,
  type PlaybookQueueActionType,
  type AgencyPlaybookQueueFilters,
} from "@/lib/agency/playbook-queue";

export const dynamic = "force-dynamic";

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function rangeLabel(range: AgencyTimeRange) {
  switch (range) {
    case "7d":
      return "7 dias";
    case "30d":
      return "30 dias";
    case "90d":
      return "90 dias";
    default:
      return "Tudo";
  }
}

function buildHref(pathname: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function badge(kind: "recent" | "open" | "aging" | "neutral" | "plan" | "active" | "suspended" | "blocked") {
  switch (kind) {
    case "recent":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "open":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
    case "aging":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "active":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "suspended":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
    case "blocked":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "plan":
      return "bg-white/5 text-white/70 border-white/10";
    default:
      return "bg-white/5 text-white/50 border-white/10";
  }
}

function labelForAction(value: PlaybookQueueActionType) {
  switch (value) {
    case "agency.monitoring_marked":
      return "Monitoring";
    case "agency.operational_review_marked":
      return "Operational review";
    case "agency.upgrade_candidate_marked":
      return "Upgrade candidate";
    case "agency.anomaly_investigation_marked":
      return "Anomaly investigation";
  }
}

export default async function AgencyPlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const context = resolveTenantContext(user);

  if (!user) {
    redirect("/login");
  }

  if (context.role && isMerchantRole(context.role)) {
    redirect("/merchant");
  }

  if (!context.role || !isAgencyRole(context.role)) {
    redirect("/login");
  }

  const resolved = await searchParams;
  const range = normalizeAgencyTimeRange(firstValue(resolved.range), "all");
  const orgId = normalize(firstValue(resolved.orgId));
  const actionTypeValue = normalize(firstValue(resolved.actionType));
  const actionType = actionTypeValue.startsWith("agency.") ? (actionTypeValue as PlaybookQueueActionType) : "";
  const limit = Number(firstValue(resolved.limit)) || 50;

  const filters: AgencyPlaybookQueueFilters = {
    range,
    orgId: orgId || null,
    actionType: actionType && actionType.startsWith("agency.") ? (actionType as PlaybookQueueActionType) : null,
    limit,
  };

  const [summary, items, orgs] = await Promise.all([
    getPlaybookQueueSummary(filters),
    listPlaybookQueueItems(filters),
    listAgencyOrgRows(),
  ]);

  const orgOptions = orgs
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
    .slice(0, 50);
  const exportParams = {
    range,
    orgId: orgId || undefined,
    actionType: actionType || undefined,
    limit,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-6 pt-10 pb-8 border-b border-white/5 sticky top-0 z-40 bg-black/80 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase font-bold tracking-[0.5em] text-[#D4AF37]">
              Agency Playbooks Queue
            </Text>
            <Heading as="h1" className="text-3xl uppercase tracking-tighter">
              Fila visual de playbooks
            </Heading>
            <Text className="text-sm text-white/50 max-w-2xl">
              Eventos operacionais já marcados, com status leve e links diretos para a org.
            </Text>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge("plan")}`}>
              Janela {rangeLabel(range)}
            </span>
            <Link href="/agency">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Agency
              </VenusButton>
            </Link>
            <Link href={buildHref("/agency/billing", { range })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Billing
              </VenusButton>
            </Link>
            <Link href={buildHref("/api/agency/playbooks/export", { ...exportParams, format: "csv" })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                CSV
              </VenusButton>
            </Link>
            <Link href={buildHref("/api/agency/playbooks/export", { ...exportParams, format: "json" })}>
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                JSON
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard label="Itens" value={summary.total_items.toString()} />
          <SummaryCard label="Recentes" value={summary.recent_items.toString()} />
          <SummaryCard label="Open" value={summary.open_items.toString()} />
          <SummaryCard label="Aging" value={summary.aging_items.toString()} />
        </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(Object.keys(summary.by_action_type) as PlaybookQueueActionType[]).map((actionKey) => (
            <SummaryCard
              key={actionKey}
              label={labelForAction(actionKey)}
              value={summary.by_action_type[actionKey].toString()}
            />
          ))}
        </div>

        <section className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-4">
          <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
            Filtros simples
          </Heading>
          <form className="grid grid-cols-1 md:grid-cols-5 gap-3" method="get">
            <label className="space-y-2">
              <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Período</Text>
              <select name="range" defaultValue={range} className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                <option value="all">Tudo</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
                <option value="90d">90 dias</option>
              </select>
            </label>
            <label className="space-y-2">
              <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Org</Text>
              <select name="orgId" defaultValue={orgId} className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                <option value="">Todas</option>
                {orgOptions.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Action</Text>
              <select name="actionType" defaultValue={actionType} className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                <option value="">Todas</option>
                <option value="agency.monitoring_marked">Monitoring</option>
                <option value="agency.operational_review_marked">Operational review</option>
                <option value="agency.upgrade_candidate_marked">Upgrade candidate</option>
                <option value="agency.anomaly_investigation_marked">Anomaly investigation</option>
              </select>
            </label>
            <label className="space-y-2">
              <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">Limit</Text>
              <input
                name="limit"
                type="number"
                min={1}
                max={100}
                defaultValue={limit}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white"
              />
            </label>
            <div className="flex items-end">
              <VenusButton type="submit" variant="solid" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold bg-white text-black w-full">
                Aplicar
              </VenusButton>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
            Itens da fila
          </Heading>
          {items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.event_id} className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <Heading as="h3" className="text-xl tracking-tighter">
                      {item.org_name}
                    </Heading>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      {item.org_slug} · {item.action_type} · {item.label}
                    </Text>
                    <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                      {item.created_at}
                    </Text>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border ${badge(item.status_light)}`}>
                      {item.status_light}
                    </span>
                    <Link href={`/agency/orgs/${item.org_id}`}>
                      <VenusButton variant="glass" className="h-9 px-4 rounded-full uppercase tracking-[0.25em] text-[8px] font-bold border-white/10">
                        Ver org
                      </VenusButton>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-[28px] bg-white/[0.03] border border-white/5 text-center">
              <Heading as="h3" className="text-lg uppercase tracking-tight">
                Sem itens na fila
              </Heading>
              <Text className="text-sm text-white/40 mt-2">
                A fila só exibe eventos reais marcados em tenant_events.
              </Text>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{label}</Text>
      <Heading as="h3" className="text-2xl tracking-tighter">
        {value}
      </Heading>
    </div>
  );
}
