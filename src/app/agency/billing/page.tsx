import Link from "next/link";
import { redirect } from "next/navigation";

import { listAgencyBillingRows, type AgencyBillingRow } from "@/lib/billing";
import { isStripeBillingConfigured, isStripeBillingStatusBlocking, normalizeStripeBillingStatus, resolveStripePriceId } from "@/lib/billing/stripe";
import { resolveAgencySession } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-timeout";

export const dynamic = "force-dynamic";

const PLAN_MRR: Record<string, number> = {
  freemium: 0,
  free: 0,
  starter: 297,
  pro: 697,
  growth: 697,
  scale: 997,
  enterprise: 1997,
};

type RevenueHistoryRow = {
  usage_date: string | null;
  org_id: string | null;
  revenue_cents: number | null;
  cost_cents: number | null;
};

type CommissionHistoryRow = {
  org_id: string | null;
  client_phone: string | null;
  product_id: string | null;
  sale_amount: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  confirmed_at: string | null;
};

function planPrice(planId: string | null | undefined) {
  return PLAN_MRR[(planId || "starter").toLowerCase()] ?? PLAN_MRR.starter;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Sem dados";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function statusTone(row: AgencyBillingRow) {
  const billingStatus = normalizeStripeBillingStatus(row.billing_status);
  if (billingStatus && isStripeBillingStatusBlocking(billingStatus)) return "red";
  if (billingStatus === "trialing") return "gold";
  if (row.kill_switch || row.status === "blocked") return "red";
  if (row.status === "suspended" || row.billing_risk === "high") return "amber";
  return "green";
}

function isBillingLive(row: AgencyBillingRow) {
  const billingStatus = normalizeStripeBillingStatus(row.billing_status);
  if (billingStatus) {
    return billingStatus === "active" || billingStatus === "trialing";
  }

  return row.status === "active" && !row.kill_switch;
}

function statusClass(tone: "green" | "amber" | "red" | "gold") {
  if (tone === "red") return "text-[#ff4444] border-[#ff4444]/30 bg-[#ff4444]/10";
  if (tone === "amber") return "text-[#ffaa00] border-[#ffaa00]/30 bg-[#ffaa00]/10";
  if (tone === "gold") return "text-[#C9A84C] border-[#C9A84C]/30 bg-[#C9A84C]/10";
  return "text-[#00ff88] border-[#00ff88]/30 bg-[#00ff88]/10";
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "green" | "amber" | "red" | "gold";
}) {
  return (
    <div className="bg-[#0f1410] p-5">
      <p className="font-mono text-[9px] uppercase tracking-[1px] text-[#6b7d6c]">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold ${tone === "green" ? "text-[#00ff88]" : tone === "amber" ? "text-[#ffaa00]" : tone === "red" ? "text-[#ff4444]" : "text-[#C9A84C]"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-[#6b7d6c]">{sub}</p>
    </div>
  );
}

function buildBreakdown(rows: AgencyBillingRow[]) {
  const map = new Map<string, { count: number; mrr: number }>();
  for (const row of rows) {
    const plan = (row.plan_id || "starter").toLowerCase();
    const current = map.get(plan) || { count: 0, mrr: 0 };
    current.count += 1;
    current.mrr += row.status === "active" && !row.kill_switch ? planPrice(plan) : 0;
    map.set(plan, current);
  }
  return Array.from(map.entries()).sort((left, right) => right[1].mrr - left[1].mrr);
}

async function loadRevenueHistory() {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await queryWithTimeout(
    admin
      .from("org_usage_daily")
      .select("usage_date, org_id, revenue_cents, cost_cents")
      .gte("usage_date", thirtyDaysAgo)
      .order("usage_date", { ascending: false })
      .limit(60),
    { data: [], error: null }
  );

  if (result.error) return [];
  return (result.data || []) as RevenueHistoryRow[];
}

async function loadCommissionHistory() {
  const admin = createAdminClient();
  const result = await queryWithTimeout(
    admin
      .from("commission_events")
      .select("org_id, client_phone, product_id, sale_amount, commission_rate, commission_amount, confirmed_at")
      .order("confirmed_at", { ascending: false })
      .limit(100),
    { data: [], error: null }
  );

  if (result.error) return [];
  return (result.data || []) as CommissionHistoryRow[];
}

export default async function AgencyBillingPage() {
  try {
    await resolveAgencySession();
  } catch {
    redirect("/login");
  }

  const [rows, revenueRows, commissionRows] = await Promise.all([
    listAgencyBillingRows({ range: "all" }).catch(() => [] as AgencyBillingRow[]),
    loadRevenueHistory().catch(() => [] as RevenueHistoryRow[]),
    loadCommissionHistory().catch(() => [] as CommissionHistoryRow[]),
  ]);

  const stripeConfigured = isStripeBillingConfigured();
  const activeRows = rows.filter((row) => isBillingLive(row));
  const mrrTotal = activeRows.reduce((sum, row) => sum + planPrice(row.plan_id), 0);
  const breakdown = buildBreakdown(rows);
  const pendingRows = rows.filter((row) => !isBillingLive(row) || row.billing_risk === "high");
  const revenueTotal = revenueRows.reduce((sum, row) => sum + Math.round((row.revenue_cents || 0) / 100), 0);
  const costTotal = revenueRows.reduce((sum, row) => sum + Math.round((row.cost_cents || 0) / 100), 0);
  const commissionTotal = commissionRows.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
  const commissionByOrg = commissionRows.reduce<Record<string, { amount: number; count: number }>>((acc, row) => {
    const key = row.org_id || "unknown";
    const current = acc[key] || { amount: 0, count: 0 };
    current.amount += Number(row.commission_amount || 0);
    current.count += 1;
    acc[key] = current;
    return acc;
  }, {});
  const commissionBreakdown = Object.entries(commissionByOrg)
    .map(([orgId, value]) => ({ orgId, ...value }))
    .sort((left, right) => right.amount - left.amount);

  return (
    <main className="min-h-screen bg-[#080c0a] text-[#e8f0e9]">
      <section className="sticky top-0 z-40 border-b border-[#1e2820] bg-[#0f1410]/95 px-6 py-5 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#C9A84C]">INOVACORTEX / FINANCEIRO</p>
            <h1 className="mt-1 font-mono text-2xl font-bold uppercase tracking-tight">Controle Financeiro da Agência</h1>
          </div>
          <Link href="/agency" className="font-mono text-[11px] uppercase tracking-[1px] text-[#C9A84C]">
            Voltar ao overview
          </Link>
        </div>
      </section>

      <section className="grid gap-[1px] bg-[#1e2820] md:grid-cols-4">
        <Kpi label="MRR total" value={formatMoney(mrrTotal)} sub={`${activeRows.length} lojas ativas`} tone="gold" />
        <Kpi label="Planos pagos" value={String(activeRows.filter((row) => planPrice(row.plan_id) > 0).length)} sub="base ativa monetizada" tone="green" />
        <Kpi label="Pendências" value={String(pendingRows.length)} sub="inadimplência, risco ou bloqueio" tone={pendingRows.length ? "amber" : "green"} />
        <Kpi label="Receita operacional 30d" value={formatMoney(revenueTotal)} sub={`custo registrado ${formatMoney(costTotal)}`} tone="gold" />
      </section>

      <section className="border-b border-[#1e2820] bg-[#0f1410] px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`font-mono text-[10px] uppercase tracking-[1px] ${stripeConfigured ? "text-[#00ff88]" : "text-[#ffaa00]"}`}>
            Stripe {stripeConfigured ? "configurado" : "fallback ativo"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-[#6b7d6c]">
            Checkout por org via webhook e tabela de subscriptions
          </span>
        </div>
      </section>

      <section className="grid gap-[1px] bg-[#1e2820] lg:grid-cols-[1fr_360px]">
        <div className="space-y-6 bg-[#080c0a] p-6">
          <div className="rounded-none border border-[#1e2820] bg-[#0f1410]">
            <div className="flex items-center justify-between border-b border-[#1e2820] px-5 py-4">
              <h2 className="font-mono text-xs uppercase tracking-[1px] text-[#6b7d6c]">Distribuição por plano</h2>
              <span className="font-mono text-[10px] uppercase tracking-[1px] text-[#C9A84C]">{rows.length} lojas</span>
            </div>
            <div className="divide-y divide-[#1e2820]">
              {breakdown.length ? (
                breakdown.map(([plan, item]) => (
                  <div key={plan} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
                      <p className="font-mono text-sm uppercase text-[#e8f0e9]">{plan}</p>
                    </div>
                    <p className="font-mono text-sm text-[#6b7d6c]">{item.count} lojas</p>
                    <p className="font-mono text-sm font-bold text-[#C9A84C]">{formatMoney(item.mrr)}</p>
                  </div>
                ))
              ) : (
                <p className="px-5 py-8 text-sm text-[#6b7d6c]">Sem organizações para calcular MRR.</p>
              )}
            </div>
          </div>

          <div className="rounded-none border border-[#1e2820] bg-[#0f1410]">
            <div className="border-b border-[#1e2820] px-5 py-4">
              <h2 className="font-mono text-xs uppercase tracking-[1px] text-[#6b7d6c]">Pagamentos pendentes</h2>
            </div>
            <div className="divide-y divide-[#1e2820]">
              {pendingRows.length ? (
                pendingRows.map((row) => {
                  const tone = statusTone(row);
                  return (
                    <div key={row.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <div>
                        <p className="font-mono text-sm uppercase text-[#e8f0e9]">{row.name}</p>
                        <p className="mt-1 text-xs text-[#6b7d6c]">
                          {row.slug} / plano {row.plan_id || "sem dados"}
                        </p>
                        {row.billing_status ? (
                          <p className="mt-1 text-[10px] uppercase tracking-[1px] text-[#C9A84C]">
                            Stripe {row.billing_status}
                          </p>
                        ) : null}
                      </div>
                      <span className={`w-fit border px-3 py-1 font-mono text-[10px] uppercase ${statusClass(tone)}`}>
                        {row.kill_switch ? "kill switch" : row.status}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/agency/merchants/${row.id}`} className="font-mono text-[11px] uppercase tracking-[1px] text-[#C9A84C]">
                          Abrir loja
                        </Link>
                        <form action="/api/agency/billing/checkout" method="post">
                          <input type="hidden" name="orgId" value={row.id} />
                          <input type="hidden" name="planId" value={row.plan_id || "starter"} />
                          <button
                            type="submit"
                            className="font-mono text-[11px] uppercase tracking-[1px] text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!stripeConfigured || !resolveStripePriceId(row.plan_id)}
                          >
                            {stripeConfigured ? "Ativar Stripe" : "Stripe indisponível"}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="px-5 py-8 text-sm text-[#6b7d6c]">Nenhum pagamento pendente identificado nos sinais atuais.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6 bg-[#0f1410] p-6">
          <div className="rounded-none border border-[#1e2820] bg-[#141a15] p-5">
            <h2 className="font-mono text-xs uppercase tracking-[1px] text-[#6b7d6c]">Comissão separada do MRR</h2>
            <div className="mt-5 space-y-3">
              <p className="font-mono text-lg font-bold text-[#C9A84C]">{formatMoney(commissionTotal)}</p>
              <p className="text-sm text-[#6b7d6c]">
                Comissão confirmada por venda. O valor abaixo não entra no MRR e fica segregado por loja.
              </p>
              <div className="space-y-2">
                {commissionBreakdown.length ? (
                  commissionBreakdown.slice(0, 6).map((row) => (
                    <div key={row.orgId} className="flex items-center justify-between border-b border-[#1e2820] pb-2">
                      <span className="text-[10px] uppercase tracking-[1px] text-white/70">{row.orgId}</span>
                      <span className="font-mono text-sm text-[#C9A84C]">{formatMoney(row.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#6b7d6c]">Sem eventos de comissão registrados.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-none border border-[#1e2820] bg-[#141a15] p-5">
            <h2 className="font-mono text-xs uppercase tracking-[1px] text-[#6b7d6c]">Histórico de receita</h2>
            <div className="mt-5 space-y-3">
              {revenueRows.length ? (
                revenueRows.slice(0, 12).map((row, index) => (
                  <div key={`${row.org_id}-${row.usage_date}-${index}`} className="flex items-center justify-between border-b border-[#1e2820] pb-3">
                    <div>
                      <p className="font-mono text-sm text-[#e8f0e9]">{formatMoney(Math.round((row.revenue_cents || 0) / 100))}</p>
                      <p className="text-xs text-[#6b7d6c]">{formatDate(row.usage_date)}</p>
                    </div>
                    <span className="font-mono text-[10px] uppercase text-[#6b7d6c]">
                      custo {formatMoney(Math.round((row.cost_cents || 0) / 100))}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#6b7d6c]">Sem linhas de org_usage_daily nos últimos 30 dias.</p>
              )}
            </div>
          </div>

          <div className="rounded-none border border-[#1e2820] bg-[#141a15] p-5">
            <h2 className="font-mono text-xs uppercase tracking-[1px] text-[#6b7d6c]">Radar financeiro</h2>
            <div className="mt-5 space-y-3">
              <p className="font-mono text-lg font-bold text-[#C9A84C]">{formatMoney(mrrTotal)}</p>
              <p className="text-sm text-[#6b7d6c]">
                MRR calculado por plan_id das lojas ativas. Os pagamentos pendentes usam status, kill switch e risco de billing porque não há tabela dedicada de invoices neste código.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
