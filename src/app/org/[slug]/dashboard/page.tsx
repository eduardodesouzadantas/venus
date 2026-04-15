import { Suspense } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Image as ImageIcon,
  LayoutGrid,
  Settings,
  Share2,
  Sparkles,
  ShoppingBag,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantActionPanel } from "@/components/dashboard/MerchantActionPanel";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { loadMerchantRoiMetrics, type MerchantRoiMetrics } from "@/lib/merchant/roi";
import { createClient } from "@/lib/supabase/server";
import { buildInventoryAlerts, formatStockStatusLabel, resolveProductStockSnapshot, sumVariantQuantity, type InventoryAlert, type ProductStockSnapshot } from "@/lib/catalog/stock";
import { isAgencyRole, isTenantActive, fetchTenantBySlug } from "@/lib/tenant/core";

interface DashboardStats {
  leadsAtivos: number;
  leadsGanhos: number;
  tryonsWeek: number;
  postagensWeek: number;
  referralsWeek: number;
  urgentLead: { name: string } | null;
  leadsByStatus: { new: number; engaged: number; qualified: number; offer: number; won: number };
  productsWithTryons: Array<{ id: string; name: string; image_url: string | null; stockSnapshot: ProductStockSnapshot; tryon_count: number }>;
  inventoryInsights: InventoryAlert[];
  roi: MerchantRoiMetrics;
}

async function getDashboardData(orgId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    leadsAtivosResult,
    leadsGanhosResult,
    tryonsResult,
    postagensResult,
    referralsResult,
    urgentLeadResult,
    leadsByStatusResult,
    productsResult,
    productTryonsResult,
    variantsResult,
    roiResult,
  ] = await Promise.all([
    supabase.from("crm_leads").select("*", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["new", "engaged", "qualified"]),
    supabase.from("crm_leads").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "won").gte("updated_at", startOfMonth.toISOString()),
    supabase.from("tryon_events").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "completed").gte("created_at", startOfWeek.toISOString()),
    supabase.from("share_events").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("confirmed_at", "is", null).gte("created_at", startOfWeek.toISOString()),
    supabase.from("referral_conversions").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("converted_at", startOfWeek.toISOString()),
    supabase.from("crm_leads").select("name").eq("org_id", orgId).eq("status", "qualified").order("updated_at", { ascending: true }).limit(1).maybeSingle<{ name: string }>(),
    supabase.from("crm_leads").select("status").eq("org_id", orgId).then(({ data }) => {
      const counts = { new: 0, engaged: 0, qualified: 0, offer: 0, won: 0 };
      data?.forEach((lead) => {
        if (lead.status in counts) counts[lead.status as keyof typeof counts]++;
      });
      return counts;
    }),
    supabase.from("products").select("id, name, image_url, stock_qty, reserved_qty, stock_status, stock").eq("org_id", orgId).order("created_at", { ascending: false }).limit(200),
    supabase.from("tryon_events").select("product_id, created_at, status").eq("org_id", orgId).eq("status", "completed").gte("created_at", thirtyDaysAgo).limit(2000),
    supabase.from("product_variants").select("product_id, quantity, active").eq("org_id", orgId).limit(2000),
    loadMerchantRoiMetrics(supabase, orgId).catch(() => ({
      leadsGenerated: 0,
      leadsConverted: 0,
      campaignsExecuted: 0,
      estimatedSalesImpact: null,
      estimatedRevenueRange: { low: null, high: null },
      dataConfidence: "low" as const,
      notes: ["Métricas de ROI indisponíveis no momento."],
    })),
  ]);

  if (productsResult.error) {
    throw productsResult.error;
  }
  if (productTryonsResult.error) {
    throw productTryonsResult.error;
  }
  if (variantsResult.error) {
    throw variantsResult.error;
  }

  const products = (productsResult.data || []) as Array<{ id: string; name: string; image_url: string | null; stock_qty: number | null; reserved_qty: number | null; stock_status: string | null; stock: number | null }>;
  const tryons30d = (productTryonsResult.data || []) as Array<{ product_id: string | null; created_at: string | null; status: string | null }>;
  const variants = (variantsResult.data || []) as Array<{ product_id: string | null; quantity: number | null; active: boolean | null }>;

  const tryonsByProduct = new Map<string, number>();
  const tryons7dByProduct = new Map<string, number>();
  for (const row of tryons30d) {
    if (!row.product_id) continue;
    tryonsByProduct.set(row.product_id, (tryonsByProduct.get(row.product_id) || 0) + 1);
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (createdAt >= startOfWeek.getTime()) {
      tryons7dByProduct.set(row.product_id, (tryons7dByProduct.get(row.product_id) || 0) + 1);
    }
  }

  const variantsByProduct = variants.reduce<Record<string, Array<{ quantity: number | null; active: boolean | null }>>>((acc, row) => {
    if (!row.product_id) return acc;
    const current = acc[row.product_id] || [];
    current.push({ quantity: row.quantity, active: row.active });
    acc[row.product_id] = current;
    return acc;
  }, {});

  const productsWithTryons = products.map((product) => {
    const stockSnapshot = resolveProductStockSnapshot(product, sumVariantQuantity(variantsByProduct[product.id] || []));
    return {
      id: product.id,
      name: product.name,
      image_url: product.image_url,
      stockSnapshot,
      tryon_count: tryonsByProduct.get(product.id) || 0,
    };
  });

  const inventoryInsights = productsWithTryons.flatMap((product) =>
    buildInventoryAlerts({
      productId: product.id,
      productName: product.name,
      stockSnapshot: product.stockSnapshot,
      tryons7d: tryons7dByProduct.get(product.id) || 0,
      tryons30d: tryonsByProduct.get(product.id) || 0,
    })
  ).slice(0, 6);

  return {
    leadsAtivos: leadsAtivosResult.count ?? 0,
    leadsGanhos: leadsGanhosResult.count ?? 0,
    tryonsWeek: tryonsResult.count ?? 0,
    postagensWeek: postagensResult.count ?? 0,
    referralsWeek: referralsResult.count ?? 0,
    urgentLead: urgentLeadResult.data ?? null,
    leadsByStatus: typeof leadsByStatusResult === "object" ? leadsByStatusResult : { new: 0, engaged: 0, qualified: 0, offer: 0, won: 0 },
    productsWithTryons,
    inventoryInsights,
    roi: roiResult,
  };
}

function MiniSparkline({ trend, status }: { trend: "up" | "down" | "flat"; status: "green" | "yellow" | "red" }) {
  const points = trend === "up" ? [20, 35, 28, 45, 52, 48, 70] : trend === "down" ? [70, 55, 62, 45, 38, 42, 25] : [35, 38, 32, 35, 38, 35, 35];
  const max = 100;
  const path = points.map((y, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 48} ${max - y}`).join(" ");
  const color = status === "green" ? "#22c55e" : status === "yellow" ? "#eab308" : "#ef4444";

  return (
    <svg width="48" height="24" className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({ label, value, sub, delta, status, sparkline }: { label: string; value: string; sub: string; delta: string; status: "green" | "yellow" | "red"; sparkline: "up" | "down" | "flat" }) {
  const colorMap = { green: "bg-green-500", yellow: "bg-yellow-500", red: "bg-red-500" };
  const deltaColor = sparkline === "up" ? "text-[#00ff88]" : sparkline === "down" ? "text-[#ff4444]" : "text-white/40";

  return (
    <div className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${colorMap[status]}`} />
      <div className="flex items-center justify-between mb-4">
        <span className="text-[9px] uppercase font-bold tracking-widest text-white/30">{label}</span>
        <MiniSparkline trend={sparkline} status={status} />
      </div>
      <div className="font-mono text-2xl tracking-tighter mb-1">{value}</div>
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase tracking-widest text-white/20">{sub}</span>
        <span className={`text-[9px] font-bold ${deltaColor} flex items-center gap-1`}>
          {sparkline === "up" ? <ArrowUpRight size={10} /> : sparkline === "down" ? <ArrowDownRight size={10} /> : null}
          {delta}
        </span>
      </div>
    </div>
  );
}

function PipelineColumn({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  // 4px minimum bar height if count is 0
  const height = max > 0 ? Math.max((count / max) * 100, 3.33) : 3.33;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full flex items-end justify-center" style={{ height: 120 }}>
        <div className="w-10 rounded-t-sm transition-all duration-500" style={{ height: `${height}%`, backgroundColor: color }} />
      </div>
      <div className="font-mono text-xl font-bold">{count}</div>
      <span className="text-[8px] uppercase tracking-widest text-white/40">{label}</span>
    </div>
  );
}

function ProductCard({ product }: { product: { id: string; name: string; image_url: string | null; stockSnapshot: ProductStockSnapshot; tryon_count: number } }) {
  const stockStatus = product.stockSnapshot.stockStatus === "in_stock" ? "green" : product.stockSnapshot.stockStatus === "low_stock" ? "yellow" : "red";
  const stockColor = stockStatus === "green" ? "bg-green-500" : stockStatus === "yellow" ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={20} className="text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium truncate">{product.name}</div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${stockColor}`} />
            <span className="text-[8px] text-white/40">{formatStockStatusLabel(product.stockSnapshot.stockStatus)} · {product.stockSnapshot.availableQty} un</span>
          </div>
          <span className="text-[8px] text-white/20">{product.tryon_count} try-ons</span>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value: number | null) {
  if (value === null) return "Sem dados";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatConfidenceLabel(value: MerchantRoiMetrics["dataConfidence"]) {
  switch (value) {
    case "high":
      return "Alta";
    case "medium":
      return "Média";
    default:
      return "Baixa";
  }
}

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

export default async function MerchantDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org || !isTenantActive(org)) redirect("/merchant");

  const appMeta = user.app_metadata as Record<string, string> | undefined;
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userRole = appMeta?.role ?? userMeta?.role ?? "";
  const userOrgSlug = appMeta?.org_slug ?? userMeta?.org_slug ?? "";

  if (!isAgencyRole(userRole) && userOrgSlug !== slug) {
    redirect("/merchant");
  }

  const actionError = firstQueryValue(resolvedSearchParams.action_error);
  const stats = await getDashboardData(org.id);
  const orgBase = `/org/${slug}`;
  const displayName = org.name || slug;

  const maxPipeline = Math.max(...Object.values(stats.leadsByStatus), 1);
  const pipelineData = [
    { label: "NOVO", count: stats.leadsByStatus.new, color: "#22c55e" },
    { label: "ENGajado", count: stats.leadsByStatus.engaged, color: "#84cc16" },
    { label: "QUALIFICADO", count: stats.leadsByStatus.qualified, color: "#eab308" },
    { label: "OFERTA", count: stats.leadsByStatus.offer, color: "#f97316" },
    { label: "FECHADO", count: stats.leadsByStatus.won, color: "#ef4444" },
  ];

  const navItems = [
    { href: `${orgBase}/dashboard`, icon: <LayoutGrid size={16} />, label: "Executivo", active: true },
    { href: `${orgBase}/crm`, icon: <Target size={16} />, label: "CRM Mercury" },
    { href: `${orgBase}/catalog`, icon: <ImageIcon size={16} />, label: "Catálogo AI" },
    { href: `${orgBase}/performance`, icon: <Activity size={16} />, label: "Performance" },
    { href: `${orgBase}/audience`, icon: <Users size={16} />, label: "Audiência" },
    { href: `${orgBase}/rewards`, icon: <Share2 size={16} />, label: "Recompensas" },
    { href: `${orgBase}/gamification`, icon: <Sparkles size={16} />, label: "Gamificação" },
    { href: `${orgBase}/suggestions`, icon: <Sparkles size={16} />, label: "Sugestões IA" },
    { href: `${orgBase}/settings`, icon: <Settings size={16} />, label: "Configurações" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-56 flex-shrink-0 border-r border-white/5 flex flex-col p-4 space-y-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full border border-[#C9A84C] flex items-center justify-center overflow-hidden bg-white/5 text-[#C9A84C] font-serif font-bold text-xs">
            {org.logo_url ? (
              <img src={org.logo_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <span className="text-xs font-bold uppercase truncate">{displayName}</span>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[10px] ${item.active ? "bg-white text-black font-bold" : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
            >
              {item.icon}
              <span className="uppercase tracking-wider">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 rounded-xl bg-white/5 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold text-[10px]">
            {user.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-bold truncate">{userMeta?.name ?? user.email?.split("@")[0] ?? "Operador"}</span>
            <span className="text-[7px] text-[#C9A84C] uppercase tracking-widest">{userRole || "store"}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between mb-0 border-b border-white/5 -mx-6 px-6 py-3 bg-black">
          <div className="flex items-center gap-2">
            <div className="w-px h-3 bg-[#C9A84C]" />
            <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/80">{displayName}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[8px] uppercase font-bold tracking-[0.2em] text-[#00ff88]">● AO VIVO</span>
            </div>
          </div>
        </header>

        {stats.urgentLead && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                <AlertCircle size={14} className="text-white" />
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-red-400">Alta intenção</span>
                <div className="text-sm font-bold">{stats.urgentLead.name}</div>
              </div>
            </div>
            <Link href={`${orgBase}/whatsapp/inbox`} className="px-4 py-2 rounded-full bg-red-500 text-white text-[9px] font-bold uppercase">
              -intervir
            </Link>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-0 pt-6">
          <KpiCard label="Leads ativos" value={stats.leadsAtivos.toString()} sub="no funil" delta="+3 hoje" status={stats.leadsAtivos > 10 ? "green" : stats.leadsAtivos > 0 ? "yellow" : "red"} sparkline="up" />
          <KpiCard label="Fechados" value={stats.leadsGanhos.toString()} sub="este mês" delta="+1 semana" status={stats.leadsGanhos > 0 ? "green" : "red"} sparkline={stats.leadsGanhos > 0 ? "up" : "flat"} />
          <KpiCard label="Try-ons" value={stats.tryonsWeek.toString()} sub="esta semana" delta="+5 hoje" status={stats.tryonsWeek > 5 ? "green" : stats.tryonsWeek > 0 ? "yellow" : "red"} sparkline="up" />
          <KpiCard label="Posts" value={stats.postagensWeek.toString()} sub="confirmados" delta="+2 hoje" status={stats.postagensWeek > 0 ? "green" : "yellow"} sparkline="up" />
        </div>

        <div className="mb-6 p-4 rounded-b-2xl bg-white/[0.01] border-x border-b border-white/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-white/20 mb-4 px-2">PIPELINE DE VENDAS</div>
          <div className="flex justify-between gap-2 px-2">
            {pipelineData.map((col) => (
              <PipelineColumn key={col.label} label={col.label} count={col.count} max={maxPipeline} color={col.color} />
            ))}
          </div>
        </div>

        <section className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Leads gerados"
            value={stats.roi.leadsGenerated.toString()}
            sub="Leads reais do tenant"
            delta={stats.roi.dataConfidence === "low" ? "Dado conservador" : "Fonte operacional"}
            status={stats.roi.leadsGenerated > 0 ? "green" : "yellow"}
            sparkline={stats.roi.leadsGenerated > 0 ? "up" : "flat"}
          />
          <KpiCard
            label="Leads convertidos"
            value={stats.roi.leadsConverted.toString()}
            sub="Conversões em ganho"
            delta={stats.roi.leadsConverted > 0 ? "Conversão real" : "Sem conversão ainda"}
            status={stats.roi.leadsConverted > 0 ? "green" : "yellow"}
            sparkline={stats.roi.leadsConverted > 0 ? "up" : "flat"}
          />
          <KpiCard
            label="Campanhas executadas"
            value={stats.roi.campaignsExecuted.toString()}
            sub="Campanhas registradas"
            delta={stats.roi.campaignsExecuted > 0 ? "Atividade real" : "Sem campanhas"}
            status={stats.roi.campaignsExecuted > 0 ? "green" : "yellow"}
            sparkline={stats.roi.campaignsExecuted > 0 ? "up" : "flat"}
          />
          <KpiCard
            label="Impacto estimado"
            value={formatMoney(stats.roi.estimatedSalesImpact)}
            sub={`Confiança ${formatConfidenceLabel(stats.roi.dataConfidence)}`}
            delta={
              stats.roi.estimatedRevenueRange.low && stats.roi.estimatedRevenueRange.high
                ? `${formatMoney(stats.roi.estimatedRevenueRange.low)} - ${formatMoney(stats.roi.estimatedRevenueRange.high)}`
                : "Faixa insuficiente"
            }
            status={stats.roi.estimatedSalesImpact ? "green" : "yellow"}
            sparkline={stats.roi.estimatedSalesImpact ? "up" : "flat"}
          />
        </section>

        <section className="mb-6 rounded-[28px] border border-white/5 bg-white/[0.02] p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">ROI operacional</Text>
              <Heading as="h3" className="text-lg uppercase tracking-tight">
                Valor claro por tenant
              </Heading>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/40">
              {stats.roi.dataConfidence === "low" ? "Fallback conservador aplicado" : "Métrica calculada server-side"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {stats.roi.notes.map((note) => (
              <div key={note} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3 text-sm text-white/55">
                {note}
              </div>
            ))}
          </div>
        </section>

        <Suspense
          fallback={
            <section className="mb-6 space-y-4 rounded-[32px] border border-white/5 bg-white/[0.03] p-5">
              <div className="space-y-2">
                <div className="h-3 w-28 rounded-full bg-white/10" />
                <div className="h-6 w-96 max-w-full rounded-full bg-white/10" />
                <div className="h-4 w-[28rem] max-w-full rounded-full bg-white/10" />
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="h-36 rounded-[28px] bg-white/5" />
                  <div className="h-36 rounded-[28px] bg-white/5" />
                </div>
                <div className="h-[20rem] rounded-[28px] bg-white/5" />
              </div>
            </section>
          }
        >
          <MerchantActionPanel orgId={org.id} orgSlug={slug} orgBase={orgBase} actionError={actionError || null} />
        </Suspense>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <section className="col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">CATÁLOGO</span>
              <Link href={`${orgBase}/catalog`} className="text-[9px] text-[#C9A84C]">gerenciar →</Link>
            </div>
            <div className="space-y-2">
              {stats.productsWithTryons.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              {stats.productsWithTryons.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                  <ShoppingBag size={24} className="text-white/10 mb-3" />
                  <span className="text-white/40 text-[11px] mb-4">Seu catálogo está vazio</span>
                  <Link href={`${orgBase}/catalog/new`} className="px-5 py-2 rounded-full bg-[linear-gradient(180deg,#F1D77A_0%,#C9A84C_100%)] text-black text-[9px] font-bold uppercase tracking-wider">
                    Adicionar primeiro produto →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/5 bg-white/[0.02] p-5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-3 block">ROTAS RÁPIDAS</span>
            <div className="space-y-2">
              <Link href={orgBase + "/whatsapp/inbox"} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 hover:bg-white/[0.06]">
                Abrir inbox operacional
                <ArrowRight size={12} />
              </Link>
              <Link href={orgBase + "/crm"} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 hover:bg-white/[0.06]">
                Revisar leads do CRM
                <ArrowRight size={12} />
              </Link>
              <Link href={orgBase + "/rewards"} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 hover:bg-white/[0.06]">
                Ver recompensa e viral
                <ArrowRight size={12} />
              </Link>
              <Link href={orgBase + "/gamification"} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 hover:bg-white/[0.06]">
                Abrir gamificação
                <ArrowRight size={12} />
              </Link>
            </div>
          </section>
        </div>

        <section className="mb-6 space-y-4 rounded-[32px] border border-white/5 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">Estoque</Text>
              <Heading as="h3" className="text-xl uppercase tracking-tight">
                Radar inteligente
              </Heading>
            </div>
            <Link href={`${orgBase}/catalog`} className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">
              Ver catálogo
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {stats.inventoryInsights.length ? (
              stats.inventoryInsights.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[24px] border p-4 ${item.severity === "critical"
                      ? "border-red-500/20 bg-red-500/10"
                      : item.severity === "alert"
                        ? "border-amber-500/20 bg-amber-500/10"
                        : "border-white/5 bg-black/20"
                    }`}
                >
                  <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/30">{item.title}</Text>
                  <p className="mt-2 text-sm text-white/80">{item.description}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-white/5 bg-black/20 p-4 text-sm text-white/45 md:col-span-3">
                Nenhum insight relevante de estoque no momento.
              </div>
            )}
          </div>
        </section>

        <div className="p-4 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#C9A84C] mb-2">LOOP VIRAL HOJE</div>
          <div className="flex items-center gap-8">
            <div className="font-mono text-xl"><span className="text-white/60">{stats.postagensWeek}</span> posts</div>
            <div className="font-mono text-xl"><span className="text-white/60">{stats.referralsWeek}</span> entradas</div>
            <div className="font-mono text-xl"><span className="text-white/60">R$ 0</span> CAC</div>
          </div>
        </div>
      </main>
    </div>
  );
}
