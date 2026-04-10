import type { ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit,
  ChevronRight,
  DollarSign,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  PieChart,
  Plus,
  Settings,
  Share2,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Target,
  Users,
  Zap,
  Star,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, isTenantActive, fetchTenantBySlug } from "@/lib/tenant/core";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

interface DashboardStats {
  leadsAtivos: number;
  leadsGanhos: number;
  tryonsWeek: number;
  postagensWeek: number;
  referralsWeek: number;
  urgentLead: { name: string } | null;
  leadsByStatus: { new: number; engaged: number; qualified: number; offer: number; won: number };
  productsWithTryons: Array<{ id: string; name: string; image_url: string | null; stock: number; tryon_count: number }>;
}

async function getDashboardData(orgId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = now.toISOString().split("T")[0];

  const [
    leadsAtivosResult,
    leadsGanhosResult,
    tryonsResult,
    postagensResult,
    referralsResult,
    urgentLeadResult,
    leadsByStatusResult,
    productsResult,
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

    supabase.from("products").select("id, name, image_url, stock").eq("org_id", orgId).then(async ({ data: products }) => {
      if (!products) return [];
      const productIds = products.map((p) => p.id);
      const { data: tryons } = await supabase.from("tryon_events").select("product_id").eq("org_id", orgId).in("product_id", productIds).eq("status", "completed");
      const tryonCounts: Record<string, number> = {};
      tryons?.forEach((t) => {
        tryonCounts[t.product_id] = (tryonCounts[t.product_id] || 0) + 1;
      });
      return products.map((p) => ({
        ...p,
        tryon_count: tryonCounts[p.id] || 0,
      }));
    }),
  ]);

  return {
    leadsAtivos: leadsAtivosResult.count ?? 0,
    leadsGanhos: leadsGanhosResult.count ?? 0,
    tryonsWeek: tryonsResult.count ?? 0,
    postagensWeek: postagensResult.count ?? 0,
    referralsWeek: referralsResult.count ?? 0,
    urgentLead: urgentLeadResult.data ?? null,
    leadsByStatus: typeof leadsByStatusResult === "object" ? leadsByStatusResult : { new: 0, engaged: 0, qualified: 0, offer: 0, won: 0 },
    productsWithTryons: productsResult as DashboardStats["productsWithTryons"],
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

function ProductCard({ product }: { product: { id: string; name: string; image_url: string | null; stock: number; tryon_count: number } }) {
  const stockStatus = product.stock > 5 ? "green" : product.stock > 0 ? "yellow" : "red";
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
            <span className="text-[8px] text-white/40">{product.stock} un</span>
          </div>
          <span className="text-[8px] text-white/20">{product.tryon_count} try-ons</span>
        </div>
      </div>
    </div>
  );
}

function AdvisorCard({ icon, iconColor, title, text, action, actionHref }: { icon: "alert" | "star" | "trend"; iconColor: string; title: string; text: string; action: string; actionHref: string }) {
  const icons = { alert: <AlertTriangle size={14} />, star: <Star size={14} />, trend: <TrendingUp size={14} /> };
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${iconColor} bg-opacity-10`}>
          {icons[icon]}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-[10px] text-white/50 leading-relaxed line-clamp-1">{text}</p>
      <Link href={actionHref} className="text-[9px] font-bold uppercase tracking-wider text-white/60 hover:text-white">
        {action} →
      </Link>
    </div>
  );
}

export default async function MerchantDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
    { href: `${orgBase}/catalog`, icon: <ImageIcon size={16} />, label: "Catálogo AI" },
    { href: `${orgBase}/performance`, icon: <Activity size={16} />, label: "Performance" },
    { href: `${orgBase}/audience`, icon: <Users size={16} />, label: "Audiência" },
    { href: `${orgBase}/rewards`, icon: <Share2 size={16} />, label: "Recompensas" },
    { href: `${orgBase}/suggestions`, icon: <Sparkles size={16} />, label: "Sugestões IA" },
    { href: `${orgBase}/settings`, icon: <Settings size={16} />, label: "Configurações" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-56 flex-shrink-0 border-r border-white/5 flex flex-col p-4 space-y-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full border border-[#D4AF37] flex items-center justify-center overflow-hidden bg-white/5 text-[#D4AF37] font-serif font-bold text-xs">
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[10px] ${
                item.active ? "bg-white text-black font-bold" : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.icon}
              <span className="uppercase tracking-wider">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 rounded-xl bg-white/5 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-[10px]">
            {user.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-bold truncate">{userMeta?.name ?? user.email?.split("@")[0] ?? "Operador"}</span>
            <span className="text-[7px] text-[#D4AF37] uppercase tracking-widest">{userRole || "store"}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between mb-0 border-b border-white/5 -mx-6 px-6 py-3 bg-black">
          <div className="flex items-center gap-2">
            <div className="w-px h-3 bg-[#D4AF37]" />
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

        <div className="grid grid-cols-3 gap-4 mb-6">
          <section className="col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">CATÁLOGO</span>
              <Link href={`${orgBase}/catalog`} className="text-[9px] text-[#D4AF37]">gerenciar →</Link>
            </div>
            <div className="space-y-2">
              {stats.productsWithTryons.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              {stats.productsWithTryons.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                   <ShoppingBag size={24} className="text-white/10 mb-3" />
                   <span className="text-white/40 text-[11px] mb-4">Seu catálogo está vazio</span>
                   <Link href={`${orgBase}/catalog/new`} className="px-5 py-2 rounded-full bg-[linear-gradient(180deg,#F1D77A_0%,#D4AF37_100%)] text-black text-[9px] font-bold uppercase tracking-wider">
                     Adicionar primeiro produto →
                   </Link>
                </div>
              )}
            </div>
          </section>

          <section>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-3 block">STRATEGIC ADVISOR</span>
            <div className="space-y-2">
              <AdvisorCard icon="alert" iconColor="text-red-400" title="Urgente" text="Lead qualificado há 5 dias sem contato" action="Ver inbox" actionHref={`${orgBase}/whatsapp/inbox`} />
              <AdvisorCard icon="star" iconColor="text-yellow-400" title="Oportunidade" text="Pico de interesse em try-ons essa semana" action="Criar campanha" actionHref={`${orgBase}/whatsapp/campaigns`} />
              <AdvisorCard icon="trend" iconColor="text-green-400" title="Viral" text={`${stats.postagensWeek} posts compartilhados`} action="Ver recompensas" actionHref={`${orgBase}/rewards`} />
            </div>
          </section>
        </div>

        <div className="p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">LOOP VIRAL HOJE</div>
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
