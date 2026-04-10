import Link from "next/link";
import type { CSSProperties } from "react";
import { DM_Sans, Space_Mono } from "next/font/google";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrgSoftCapSummary, getPlanSoftCaps, type OrgSoftCapSummary } from "@/lib/billing/limits";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const themeVars: CSSProperties & Record<string, string> = {
  ["--gold"]: "#C9A84C",
  ["--green"]: "#00ff88",
  ["--red"]: "#ff4444",
  ["--amber"]: "#ffaa00",
  ["--bg"]: "#080c0a",
  ["--bg2"]: "#0f1410",
  ["--bg3"]: "#141a15",
  ["--border"]: "#1e2820",
  ["--text"]: "#e8f0e9",
  ["--muted"]: "#6b7d6c",
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  plan_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  limits: Record<string, unknown> | null;
};

type OrgDashboardRow = OrgRow & {
  leads: number;
  tryons: number;
  products: number;
  usagePct: number;
  inactiveDays: number;
  freemiumDaysRemaining: number | null;
  tone: "green" | "amber" | "red";
  statusLabel: string;
  actionLabel: string;
  softCapSummary: OrgSoftCapSummary;
};

type DashboardData = {
  orgs: OrgDashboardRow[];
  activeCount: number;
  mrrTotal: number;
  tryonsToday: number;
  tryonsMonth: number;
  alertCount: number;
  planBreakdown: Array<{ plan: string; count: number }>;
  retentionPct: number;
  mrrNovo: number;
  churnRisk: number;
  iaCost: number;
};

const PLAN_VALUES: Record<string, number> = {
  starter: 297,
  pro: 697,
  enterprise: 1997,
};

const PLAN_ORDER = ["freemium", "starter", "pro", "enterprise", "growth", "scale", "free"];

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function countFrom(result: { count: number | null; error: unknown }) {
  return result.error ? 0 : result.count ?? 0;
}

function daysBetween(from: string | null, to = Date.now()) {
  if (!from) return 0;
  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((to - start) / 86_400_000));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function formatRelativeDays(days: number) {
  if (days <= 0) return "hoje";
  return `${days}d`;
}

function getPlanValue(planId: string | null) {
  return planId ? PLAN_VALUES[planId] || 0 : 0;
}

function getPlanLimit(limitValue: unknown, fallback: number) {
  return typeof limitValue === "number" && Number.isFinite(limitValue) && limitValue > 0 ? limitValue : fallback;
}

function computeUsagePct(limits: Record<string, unknown> | null, counts: { leads: number; tryons: number; products: number }, planId: string | null) {
  const softCaps = getPlanSoftCaps(planId);
  const productsLimit = getPlanLimit(limits?.products, softCaps.products);
  const leadsLimit = getPlanLimit(limits?.leads, softCaps.leads);
  const tryonsLimit = getPlanLimit(limits?.saved_results ?? limits?.tryons ?? limits?.ai_tokens_monthly, softCaps.saved_results);

  const ratios = [
    productsLimit > 0 ? (counts.products / productsLimit) * 100 : 0,
    leadsLimit > 0 ? (counts.leads / leadsLimit) * 100 : 0,
    tryonsLimit > 0 ? (counts.tryons / tryonsLimit) * 100 : 0,
  ];

  return Math.max(0, Math.min(100, Math.round(Math.max(...ratios))));
}

function resolveTone(input: {
  status: string | null;
  planId: string | null;
  usagePct: number;
  inactiveDays: number;
  freemiumDaysRemaining: number | null;
  softCapSummary: OrgSoftCapSummary;
}) {
  const status = normalize(input.status).toLowerCase();
  const planId = normalize(input.planId).toLowerCase();
  const isInactive = status !== "active";
  const isStale = input.inactiveDays > 7;
  const isExpiredFreemium = planId === "freemium" && input.freemiumDaysRemaining !== null && input.freemiumDaysRemaining <= 0;
  const isCriticalUsage = input.softCapSummary.overall_status === "critical" || input.usagePct >= 90;
  const isWarningUsage =
    planId === "freemium" || input.usagePct > 80 || input.softCapSummary.overall_status === "warning" || input.softCapSummary.warning_count > 0;

  if (isInactive || isStale || isExpiredFreemium || isCriticalUsage) {
    return "red" as const;
  }

  if (isWarningUsage) {
    return "amber" as const;
  }

  return "green" as const;
}

function resolveStatusLabel(input: {
  status: string | null;
  planId: string | null;
  usagePct: number;
  inactiveDays: number;
  freemiumDaysRemaining: number | null;
}) {
  const status = normalize(input.status).toLowerCase();
  const planId = normalize(input.planId).toLowerCase();

  if (status !== "active") {
    return `INATIVA ${formatRelativeDays(input.inactiveDays)}`;
  }

  if (input.inactiveDays > 7) {
    return `INATIVA ${formatRelativeDays(input.inactiveDays)}`;
  }

  if (planId === "freemium") {
    const remaining = input.freemiumDaysRemaining ?? 0;
    return remaining > 0 ? `FREEMIUM ${remaining}D REST.` : "FREEMIUM EXPIRADO";
  }

  if (input.usagePct > 80) {
    return `USO ${input.usagePct}%`;
  }

  return "ATIVA";
}

function resolveActionLabel(tone: "green" | "amber" | "red", statusLabel: string) {
  if (tone === "amber") return "CONVERTER →";
  if (tone === "green") return "VER →";
  return statusLabel.startsWith("INATIVA") ? "REATIVAR →" : "COBRAR →";
}

function resolveSignalGlyph(tone: "green" | "amber" | "red") {
  if (tone === "amber") return "◎";
  if (tone === "green") return "★";
  return "!";
}

function resolveSignalColor(tone: "green" | "amber" | "red") {
  if (tone === "amber") return "var(--amber)";
  if (tone === "green") return "var(--green)";
  return "var(--red)";
}

function pillTone(tone: "green" | "amber" | "red") {
  if (tone === "amber") return "border-[var(--amber)]/40 text-[var(--amber)] bg-[rgba(255,170,0,0.08)]";
  if (tone === "green") return "border-[var(--green)]/40 text-[var(--green)] bg-[rgba(0,255,136,0.08)]";
  return "border-[var(--red)]/40 text-[var(--red)] bg-[rgba(255,68,68,0.08)]";
}

function actionTone(tone: "green" | "amber" | "red") {
  if (tone === "amber") return "border-[var(--amber)]/40 text-[var(--amber)]";
  if (tone === "green") return "border-[var(--green)]/40 text-[var(--green)]";
  return "border-[var(--red)]/40 text-[var(--red)]";
}

async function loadDashboardData(): Promise<DashboardData> {
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    return {
      orgs: [],
      activeCount: 0,
      mrrTotal: 0,
      tryonsToday: 0,
      tryonsMonth: 0,
      alertCount: 0,
      planBreakdown: [],
      retentionPct: 0,
      mrrNovo: 0,
      churnRisk: 0,
      iaCost: 0,
    };
  }

  if (!admin) {
    return {
      orgs: [],
      activeCount: 0,
      mrrTotal: 0,
      tryonsToday: 0,
      tryonsMonth: 0,
      alertCount: 0,
      planBreakdown: [],
      retentionPct: 0,
      mrrNovo: 0,
      churnRisk: 0,
      iaCost: 0,
    };
  }

  const supabase = admin;

  const now = new Date();
  const since24h = new Date(now.getTime() - 86_400_000).toISOString();
  const sinceMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [orgsResult, activeCountResult, tryonsTodayResult, tryonsMonthResult] = await Promise.all([
    supabase
      .from("orgs")
      .select("id, slug, name, status, plan_id, created_at, updated_at, limits")
      .order("created_at", { ascending: false }),
    supabase.from("orgs").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("saved_results").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("saved_results").select("id", { count: "exact", head: true }).gte("created_at", sinceMonth),
  ]);

  const orgs = ((orgsResult.error ? [] : orgsResult.data) || []) as OrgRow[];
  const orgStats = await Promise.all(
    orgs.map(async (org) => {
      const [leadsResult, tryonsResult, productsResult] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        supabase.from("saved_results").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      ]);

      const leads = countFrom(leadsResult);
      const tryons = countFrom(tryonsResult);
      const products = countFrom(productsResult);
      const inactiveDays = daysBetween(org.updated_at || org.created_at);
      const freemiumDaysRemaining = normalize(org.plan_id).toLowerCase() === "freemium" ? Math.max(0, 15 - daysBetween(org.created_at)) : null;
      const softCapSummary = buildOrgSoftCapSummary({
        plan_id: org.plan_id,
        saved_results: tryons,
        leads,
        products,
        whatsapp_messages: null,
        estimated_cost_today_cents: 0,
        estimated_cost_total_cents: 0,
      });
      const usagePct = computeUsagePct(org.limits, { leads, tryons, products }, org.plan_id);
      const tone = resolveTone({
        status: org.status,
        planId: org.plan_id,
        usagePct,
        inactiveDays,
        freemiumDaysRemaining,
        softCapSummary,
      });
      const statusLabel = resolveStatusLabel({
        status: org.status,
        planId: org.plan_id,
        usagePct,
        inactiveDays,
        freemiumDaysRemaining,
      });

      return {
        ...org,
        leads,
        tryons,
        products,
        usagePct,
        inactiveDays,
        freemiumDaysRemaining,
        tone,
        statusLabel,
        actionLabel: resolveActionLabel(tone, statusLabel),
        softCapSummary,
      };
    })
  );

  const activeCount = countFrom(activeCountResult);
  const fallbackActiveCount = orgStats.filter((org) => normalize(org.status).toLowerCase() === "active").length;
  const resolvedActiveCount = activeCount > 0 ? activeCount : fallbackActiveCount;
  const mrrTotal = orgStats
    .filter((org) => normalize(org.status).toLowerCase() === "active")
    .reduce((sum, org) => sum + getPlanValue(normalize(org.plan_id).toLowerCase()), 0);

  const activeThisMonth = orgStats
    .filter((org) => normalize(org.status).toLowerCase() === "active" && org.created_at && org.created_at >= sinceMonth)
    .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""))[0];

  const alertCount = orgStats.filter((org) => org.tone === "red").length;
  const planBreakdownMap = new Map<string, number>();
  for (const org of orgStats.filter((item) => normalize(item.status).toLowerCase() === "active")) {
    const plan = normalize(org.plan_id).toLowerCase() || "sem plano";
    planBreakdownMap.set(plan, (planBreakdownMap.get(plan) || 0) + 1);
  }

  const planBreakdown = PLAN_ORDER.map((plan) => ({ plan, count: planBreakdownMap.get(plan) || 0 })).filter((item) => item.count > 0);
  for (const [plan, count] of planBreakdownMap.entries()) {
    if (!PLAN_ORDER.includes(plan)) {
      planBreakdown.push({ plan, count });
    }
  }

  const retentionPct = orgStats.length > 0 ? Math.round((resolvedActiveCount / orgStats.length) * 100) : 0;
  const mrrNovo = activeThisMonth ? getPlanValue(normalize(activeThisMonth.plan_id).toLowerCase()) : 0;
  const churnRisk = orgStats.filter((org) => org.tone === "amber" || org.tone === "red").length;
  const tryonsToday = countFrom(tryonsTodayResult);
  const tryonsMonth = countFrom(tryonsMonthResult);
  const iaCost = tryonsMonth * 0.075;

  return {
    orgs: orgStats,
    activeCount: resolvedActiveCount,
    mrrTotal,
    tryonsToday,
    tryonsMonth,
    alertCount,
    planBreakdown,
    retentionPct,
    mrrNovo,
    churnRisk,
    iaCost,
  };
}

export default async function AgencyDashboardPage() {
  const data = await loadDashboardData();

  return (
    <div className={`${dmSans.className} min-h-screen bg-[var(--bg)] text-[var(--text)]`} style={themeVars}>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg2)]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="space-y-0.5">
            <div className={`${spaceMono.className} text-[11px] uppercase tracking-[2px] text-[var(--gold)]`}>
              INOVACORTEX
            </div>
            <div className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--muted)]`}>
              CONTROL PLANE
            </div>
          </div>

          <div className={`${spaceMono.className} flex items-center gap-4 text-[10px] uppercase tracking-[1px]`}>
            <div className="flex items-center gap-2 text-[var(--green)]">
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_0_4px_rgba(0,255,136,0.08)] animate-pulse" />
              <span>TEMPO REAL</span>
            </div>
            <div className="text-[var(--gold)]">{formatInteger(data.activeCount)} LOJAS ATIVAS</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-5 lg:px-8">
        <section className="grid gap-[1px] bg-[var(--border)] lg:grid-cols-4">
          <KpiCard
            label="MRR TOTAL"
            value={formatMoney(data.mrrTotal)}
            color="var(--gold)"
            subtext="↑ crescimento"
            subtextColor="var(--green)"
          />
          <KpiCard
            label="LOJAS ATIVAS"
            value={formatInteger(data.activeCount)}
            color="var(--green)"
            subtext={data.planBreakdown.length > 0 ? data.planBreakdown.map((item) => `${item.plan} ${item.count}`).join(" · ") : "sem dados"}
            subtextColor="var(--muted)"
          />
          <KpiCard
            label="TRY-ONS HOJE"
            value={formatInteger(data.tryonsToday)}
            color="var(--amber)"
            subtext={`Custo estimado: ${formatMoney(data.tryonsToday * 0.075)}`}
            subtextColor="var(--green)"
          />
          <KpiCard
            label="ALERTAS"
            value={formatInteger(data.alertCount)}
            color="var(--red)"
            subtext="inadimplentes, inativas > 7d"
            subtextColor="var(--muted)"
          />
        </section>

        <section className="mt-[1px] grid gap-[1px] bg-[var(--border)] lg:grid-cols-[1fr_320px]">
          <div className="bg-[var(--bg2)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-4">
              <div>
                <div className={`${spaceMono.className} text-[11px] uppercase tracking-[1px] text-[var(--muted)]`}>
                  LOJAS — STATUS OPERACIONAL
                </div>
              </div>
              <Link href="/agency/billing" className={`${spaceMono.className} text-[11px] uppercase tracking-[1px] text-[var(--gold)]`}>
                + NOVA LOJA
              </Link>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {data.orgs.length > 0 ? (
                data.orgs.map((org) => (
                  <div key={org.id} className="bg-[var(--bg2)] px-4 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-2 h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: resolveSignalColor(org.tone), boxShadow: `0 0 12px ${resolveSignalColor(org.tone)}` }}
                        />
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[14px] font-semibold text-[var(--text)]">{org.name}</div>
                            <span
                              className={`${spaceMono.className} rounded-full border px-2 py-1 text-[9px] uppercase tracking-[1px] ${pillTone(org.tone)}`}
                            >
                              {normalize(org.plan_id).toUpperCase() || "SEM PLANO"}
                            </span>
                          </div>

                          <div className={`${spaceMono.className} flex flex-wrap gap-3 text-[10px] uppercase tracking-[1px] text-[var(--muted)]`}>
                            <span style={{ color: resolveSignalColor(org.tone) }}>{org.statusLabel}</span>
                            <span>CRIADA {formatDate(org.created_at)}</span>
                            <span>ATUALIZADA {formatDate(org.updated_at)}</span>
                          </div>

                          <div className={`${spaceMono.className} flex flex-wrap gap-2 text-[10px] uppercase tracking-[1px] text-[var(--text)]`}>
                            <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1">
                              LEADS {formatInteger(org.leads)}
                            </span>
                            <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1">
                              TRY-ONS {formatInteger(org.tryons)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-3 xl:w-[360px]">
                        <div className="h-[50px] overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-[3px]">
                          <div
                            className="h-full rounded-[5px]"
                            style={{
                              width: `${org.usagePct}%`,
                              background:
                                org.tone === "red"
                                  ? "linear-gradient(90deg, var(--red), #7f1d1d)"
                                  : org.tone === "amber"
                                    ? "linear-gradient(90deg, var(--amber), #7a4a00)"
                                    : "linear-gradient(90deg, var(--green), var(--gold))",
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className={`${spaceMono.className} text-[9px] uppercase tracking-[1px] text-[var(--muted)]`}>
                            USO DO PLANO
                          </div>
                          <div className={`${spaceMono.className} text-[18px] font-bold text-[var(--text)]`}>
                            {org.usagePct}%
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-start xl:justify-end">
                        <Link
                          href={`/agency/orgs/${org.id}`}
                          className={`${spaceMono.className} inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-[10px] uppercase tracking-[1px] ${actionTone(org.tone)}`}
                        >
                          {org.actionLabel}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-[var(--bg2)] px-4 py-8">
                  <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
                    <div className={`${spaceMono.className} text-[11px] uppercase tracking-[1px] text-[var(--gold)]`}>
                      0 LOJAS CADASTRADAS
                    </div>
                    <div className="mt-2 text-sm text-[var(--muted)]">
                      A base ainda esta vazia. O dashboard segue renderizando com contadores zerados.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="bg-[var(--bg2)] p-4">
            <div className="space-y-4">
              <div className="border-b border-[var(--border)] pb-4">
                <div className={`${spaceMono.className} text-[11px] uppercase tracking-[1px] text-[var(--muted)]`}>
                  RADAR — AÇÕES AGORA
                </div>
              </div>

              <div className="space-y-2">
                {data.orgs.filter((org) => org.tone !== "green").length > 0 ? (
                  data.orgs
                    .filter((org) => org.tone !== "green")
                    .map((org) => (
                      <div key={org.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`${spaceMono.className} mt-0.5 w-5 text-[16px] leading-none`}
                            style={{ color: resolveSignalColor(org.tone) }}
                          >
                            {resolveSignalGlyph(org.tone)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] leading-5 text-[var(--text)]">
                              {org.tone === "red"
                                ? `${org.name} precisa de correção imediata.`
                                : `${org.name} está perto do limite operacional.`}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Link
                                href={`/agency/orgs/${org.id}`}
                                className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--gold)]`}
                              >
                                {org.name}
                              </Link>
                              <span className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--gold)]`}>
                                {org.actionLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                ) : data.orgs.length > 0 ? (
                  <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-3">
                    <div className="flex items-start gap-3">
                      <div className={`${spaceMono.className} mt-0.5 w-5 text-[16px] leading-none text-[var(--green)]`}>★</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-5 text-[var(--text)]">
                          Operacao estavel. Nenhuma loja com alerta agora.
                        </div>
                        <div className="mt-1">
                          <Link
                            href="/agency/billing"
                            className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--gold)]`}
                          >
                            REVISAR →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg)] p-3">
                    <div className="flex items-start gap-3">
                      <div className={`${spaceMono.className} mt-0.5 w-5 text-[16px] leading-none text-[var(--green)]`}>★</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-5 text-[var(--text)]">Nenhuma loja cadastrada ainda.</div>
                        <div className="mt-1">
                          <Link
                            href="/agency/billing"
                            className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--gold)]`}
                          >
                            + NOVA LOJA →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-b border-[var(--border)] pb-4 pt-4">
                <div className={`${spaceMono.className} text-[11px] uppercase tracking-[1px] text-[var(--muted)]`}>
                  SAUDE DA REDE
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <GaugeCard label="RETENCAO %" value={`${data.retentionPct}%`} tone="green" />
                <GaugeCard label="MRR NOVO" value={formatMoney(data.mrrNovo)} tone="gold" />
                <GaugeCard label="CHURN RISCO" value={formatInteger(data.churnRisk)} tone="amber" />
                <GaugeCard label="CUSTO IA" value={formatMoney(data.iaCost)} tone="green" />
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  color,
  subtextColor,
}: {
  label: string;
  value: string;
  subtext: string;
  color: string;
  subtextColor: string;
}) {
  return (
    <div className="bg-[var(--bg2)] px-5 py-4">
      <div className={`${spaceMono.className} text-[9px] uppercase tracking-[1px] text-[var(--muted)]`}>{label}</div>
      <div className={`${spaceMono.className} mt-2 text-[26px] font-bold`} style={{ color }}>
        {value}
      </div>
      <div className={`${spaceMono.className} mt-2 text-[9px] uppercase tracking-[1px]`} style={{ color: subtextColor }}>
        {subtext}
      </div>
    </div>
  );
}

function GaugeCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "gold";
}) {
  const toneColor =
    tone === "amber" ? "var(--amber)" : tone === "gold" ? "var(--gold)" : "var(--green)";

  return (
    <div className="rounded-[10px] border border-[#2a3a2c] bg-[var(--bg3)] p-2.5">
      <div className={`${spaceMono.className} text-[9px] uppercase tracking-[1px] text-[var(--muted)]`}>{label}</div>
      <div className={`${spaceMono.className} mt-1 text-[18px] font-bold`} style={{ color: toneColor }}>
        {value}
      </div>
    </div>
  );
}
