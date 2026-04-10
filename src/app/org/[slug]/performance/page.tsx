import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  LayoutGrid,
  Package,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isTenantActive } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type PerformanceTryonRow = {
  created_at: string | null;
  product_id: string | null;
  status: string | null;
};

type PerformanceLeadRow = {
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
};

type PerformanceProductRow = {
  id: string;
  name: string;
};

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)));
}

function formatPercent(value: number) {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function toDateKey(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toShortLabel(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}`;
}

function createWindow(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildDaySeries(rows: Array<{ created_at: string | null }>, days = 30) {
  const start = createWindow(days);
  const buckets = Array.from({ length: days }, (_, index) => {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + index);
    return {
      key: toDateKey(cursor),
      label: toShortLabel(cursor),
      count: 0,
    };
  });

  for (const row of rows) {
    if (!row.created_at) continue;
    const date = new Date(row.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = buckets.find((item) => item.key === toDateKey(date));
    if (bucket) {
      bucket.count += 1;
    }
  }

  return buckets;
}

function buildSparkline(series: Array<{ count: number }>) {
  const width = 480;
  const height = 140;
  const max = Math.max(1, ...series.map((item) => item.count));
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const points = series.map((item, index) => {
    const x = Number((index * step).toFixed(2));
    const normalized = item.count / max;
    const y = Number((height - Math.max(12, normalized * (height - 20))).toFixed(2));
    return `${x},${y}`;
  });
  return { width, height, points: points.join(" ") };
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-[10px] border ${
        active
          ? "bg-white text-black border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
          : "bg-white/[0.02] text-white/45 border-white/5 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="uppercase tracking-[0.24em] font-bold">{label}</span>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone: "green" | "amber" | "red" | "gold";
}) {
  const toneMap = {
    green: "border-[#00ff88]/25 text-[#00ff88]",
    amber: "border-[#ffaa00]/25 text-[#ffaa00]",
    red: "border-[#ff4444]/25 text-[#ff4444]",
    gold: "border-[#C9A84C]/25 text-[#C9A84C]",
  };

  return (
    <div className={`rounded-[28px] border bg-[#0f1410] p-5 ${toneMap[tone]}`}>
      <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">{label}</Text>
      <div className="mt-3 font-mono text-3xl font-bold tracking-tighter">{value}</div>
      <Text className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">{sublabel}</Text>
    </div>
  );
}

function StatusDot({ tone }: { tone: "green" | "amber" | "red" }) {
  const toneMap = {
    green: "bg-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.5)]",
    amber: "bg-[#ffaa00] shadow-[0_0_12px_rgba(255,170,0,0.45)]",
    red: "bg-[#ff4444] shadow-[0_0_12px_rgba(255,68,68,0.45)]",
  };

  return <span className={`h-2 w-2 rounded-full ${toneMap[tone]}`} />;
}

async function loadPerformanceData(orgId: string) {
  const supabase = await createClient();
  const start = createWindow(30);

  const [tryonsResult, leadsResult, productsResult] = await Promise.all([
    supabase.from("tryon_events").select("created_at, product_id, status").eq("org_id", orgId).gte("created_at", start.toISOString()).order("created_at", { ascending: true }).limit(2000),
    supabase.from("crm_leads").select("created_at, updated_at, status").eq("org_id", orgId).order("created_at", { ascending: true }).limit(2000),
    supabase.from("products").select("id, name").eq("org_id", orgId).limit(1000),
  ]);

  const tryons = (tryonsResult.data || []) as PerformanceTryonRow[];
  const leads = (leadsResult.data || []) as PerformanceLeadRow[];
  const products = (productsResult.data || []) as PerformanceProductRow[];
  const series = buildDaySeries(tryons);
  const tryonsCount = tryons.length;

  const leadRows = leads.filter((row) => {
    const ref = row.created_at || row.updated_at;
    if (!ref) return false;
    const date = new Date(ref);
    return !Number.isNaN(date.getTime()) && date.getTime() >= start.getTime();
  });

  const leadsCount = leadRows.length;
  const closesCount = leadRows.filter((row) => row.status === "won").length;
  const captureRate = tryonsCount > 0 ? (leadsCount / tryonsCount) * 100 : 0;
  const closeRate = leadsCount > 0 ? (closesCount / leadsCount) * 100 : 0;
  const endToEndRate = tryonsCount > 0 ? (closesCount / tryonsCount) * 100 : 0;

  const productMap = new Map(products.map((product) => [product.id, product.name] as const));
  const counts = new Map<string, number>();
  for (const row of tryons) {
    const key = normalize(row.product_id) || "__missing__";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const topProducts = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([productId, count]) => ({
      id: productId,
      name: productId === "__missing__" ? "Produto sem vínculo" : productMap.get(productId) || "Produto sem nome",
      count,
    }));

  const topDay = [...series].sort((left, right) => right.count - left.count)[0] || null;
  const sparkline = buildSparkline(series);

  return {
    series,
    topDay,
    sparkline,
    tryonsCount,
    leadsCount,
    closesCount,
    captureRate,
    closeRate,
    endToEndRate,
    topProducts,
  };
}

export default async function MerchantPerformancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org || !isTenantActive(org)) {
    redirect("/merchant");
  }

  const appMeta = user.app_metadata as Record<string, string> | undefined;
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userRole = appMeta?.role ?? userMeta?.role ?? "";
  const userOrgSlug = appMeta?.org_slug ?? userMeta?.org_slug ?? "";

  if (!isAgencyRole(userRole) && userOrgSlug !== slug) {
    redirect("/merchant");
  }

  const data = await loadPerformanceData(org.id);
  const orgBase = `/org/${slug}`;
  const displayName = org.name || slug;
  const chart = data.sparkline;
  const maxValue = Math.max(1, ...data.series.map((item) => item.count));

  return (
    <div className="min-h-screen bg-[#080c0a] text-[#e8f0e9] flex">
      <aside className="w-72 flex-shrink-0 border-r border-[#1e2820] bg-[#0f1410] sticky top-0 h-screen p-5 flex flex-col gap-6">
        <div className="rounded-[28px] border border-[#1e2820] bg-[#141a15] p-4">
          <Text className="text-[9px] uppercase tracking-[0.35em] text-[#C9A84C]">Venus Engine</Text>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Heading as="h2" className="text-sm tracking-[0.2em] uppercase text-[#e8f0e9] truncate max-w-[160px]">
              {org.name ? org.name.slice(0, 16) + (org.name.length > 16 ? "..." : "") : (org.slug?.slice(0, 16) || slug)}
            </Heading>
            <StatusDot tone={org.status === "active" && !org.kill_switch ? "green" : org.status === "blocked" ? "red" : "amber"} />
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem href={`${orgBase}/dashboard`} icon={<LayoutGrid size={16} />} label="Executivo" />
          <NavItem href={`${orgBase}/performance`} icon={<Activity size={16} />} label="Performance" active />
          <NavItem href={`${orgBase}/audience`} icon={<Users size={16} />} label="Audiência" />
          <NavItem href={`${orgBase}/suggestions`} icon={<Sparkles size={16} />} label="Sugestões IA" />
          <NavItem href={`${orgBase}/catalog`} icon={<Package size={16} />} label="Catálogo" />
          <NavItem href={`${orgBase}/settings`} icon={<Settings size={16} />} label="Configurações" />
        </nav>

        <Link href={`${orgBase}/dashboard`} className="inline-flex items-center gap-2 rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-[#6b7d6c]">
          <ArrowLeft size={14} />
          Voltar ao dashboard
        </Link>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">Mission control / performance</Text>
            <div className="font-mono text-[18px] font-medium tracking-tight text-[#e8f0e9]">Performance</div>
            <Text className="text-xs text-[#6b7d6c]">Leitura dos últimos 30 dias com base em tryon_events e crm_leads.</Text>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#00ff88]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span>● TEMPO REAL</span>
            </div>
            <div className="rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#C9A84C]">
              {formatNumber(data.tryonsCount)} try-ons
            </div>
          </div>
        </header>

        <section className="grid gap-[1px] rounded-[32px] border border-[#1e2820] bg-[#1e2820] lg:grid-cols-[1.4fr_0.9fr]">
          <div className="bg-[#0f1410] p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Try-ons por dia</Text>
                <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                  Janela de 30 dias
                </Heading>
              </div>
              <div className="rounded-full border border-[#1e2820] bg-[#141a15] px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">
                Pico: {data.topDay ? `${data.topDay.label} / ${formatNumber(data.topDay.count)}` : "sem dados"}
              </div>
            </div>

            <div className="rounded-[26px] border border-[#1e2820] bg-[#141a15] p-4">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-56 w-full overflow-visible">
                <defs>
                  <linearGradient id="performance-line" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#00ff88" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.65" />
                  </linearGradient>
                  <linearGradient id="performance-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#00ff88" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="url(#performance-line)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={chart.points}
                />
                <polyline
                  fill="url(#performance-fill)"
                  stroke="none"
                  points={`0,${chart.height} ${chart.points} ${chart.width},${chart.height}`}
                />
              </svg>

              <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                {data.series.slice(-6).map((day) => (
                  <div key={day.key} className="rounded-2xl border border-[#1e2820] bg-[#0f1410] px-3 py-2">
                    <Text className="text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">{day.label}</Text>
                    <div className="mt-1 font-mono text-lg font-bold text-[#e8f0e9]">{day.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="bg-[#0f1410] p-5 md:p-6">
            <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Funil de conversão</Text>
            <div className="mt-4 space-y-4">
              <MetricCard label="Try-ons" value={formatNumber(data.tryonsCount)} sublabel="últimos 30 dias" tone="green" />
              <MetricCard label="Leads" value={formatNumber(data.leadsCount)} sublabel={`captura ${formatPercent(data.captureRate)}`} tone="amber" />
              <MetricCard label="Fechamentos" value={formatNumber(data.closesCount)} sublabel={`lead → close ${formatPercent(data.closeRate)}`} tone="red" />
              <MetricCard label="Conversão total" value={formatPercent(data.endToEndRate)} sublabel="try-on → fechamento" tone="gold" />
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Produtos mais testados</Text>
                <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                  Ranking de try-ons
                </Heading>
              </div>
              <Target size={18} className="text-[#C9A84C]" />
            </div>

            <div className="mt-5 space-y-3">
              {data.topProducts.length > 0 ? (
                data.topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center gap-4 rounded-[22px] border border-[#1e2820] bg-[#141a15] px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1e2820] bg-[#0f1410] font-mono text-[10px] font-bold text-[#C9A84C]">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#e8f0e9]">{product.name}</div>
                      <div className="text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">
                        {formatNumber(product.count)} testes
                      </div>
                    </div>
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-[#0f1410]">
                      <div className="h-full rounded-full bg-[#00ff88]" style={{ width: `${Math.max(6, (product.count / maxValue) * 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#1e2820] bg-[#141a15] p-6 text-sm text-[#6b7d6c]">
                  Nenhum try-on registrado no período.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Leitura rápida</Text>
                <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                  Sinais operacionais
                </Heading>
              </div>
              <TrendingUp size={18} className="text-[#00ff88]" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#1e2820] bg-[#141a15] p-4">
                <Text className="text-[9px] uppercase tracking-[0.28em] text-[#6b7d6c]">Fluxo mais quente</Text>
                <div className="mt-3 font-mono text-2xl font-bold text-[#00ff88]">{formatNumber(data.tryonsCount - data.leadsCount)}</div>
                <Text className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">try-ons acima de leads</Text>
              </div>
              <div className="rounded-[22px] border border-[#1e2820] bg-[#141a15] p-4">
                <Text className="text-[9px] uppercase tracking-[0.28em] text-[#6b7d6c]">Eficiência</Text>
                <div className="mt-3 font-mono text-2xl font-bold text-[#C9A84C]">{formatPercent(data.captureRate)}</div>
                <Text className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">try-on → lead</Text>
              </div>
              <div className="rounded-[22px] border border-[#1e2820] bg-[#141a15] p-4">
                <Text className="text-[9px] uppercase tracking-[0.28em] text-[#6b7d6c]">Fechamento</Text>
                <div className="mt-3 font-mono text-2xl font-bold text-[#ff4444]">{formatPercent(data.closeRate)}</div>
                <Text className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">lead → won</Text>
              </div>
              <div className="rounded-[22px] border border-[#1e2820] bg-[#141a15] p-4">
                <Text className="text-[9px] uppercase tracking-[0.28em] text-[#6b7d6c]">Volume médio</Text>
                <div className="mt-3 font-mono text-2xl font-bold text-[#ffaa00]">
                  {formatNumber(data.series.reduce((acc, item) => acc + item.count, 0) / data.series.length)}
                </div>
                <Text className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">try-ons por dia</Text>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
