import type { ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BrainCircuit,
  ChevronRight,
  DollarSign,
  Edit3,
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
}

async function getDashboardData(orgId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    leadsAtivosResult,
    leadsGanhosResult,
    tryonsResult,
    postagensResult,
    referralsResult,
    urgentLeadResult,
  ] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["new", "engaged", "qualified"]),

    supabase
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "won")
      .gte("updated_at", startOfMonth.toISOString()),

    supabase
      .from("tryon_events")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "completed")
      .gte("created_at", startOfWeek.toISOString()),

    supabase
      .from("share_events")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("confirmed_at", "is", null)
      .gte("created_at", startOfWeek.toISOString()),

    supabase
      .from("referral_conversions")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("converted_at", startOfWeek.toISOString()),

    supabase
      .from("crm_leads")
      .select("name")
      .eq("org_id", orgId)
      .eq("status", "qualified")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ name: string }>(),
  ]);

  return {
    leadsAtivos: leadsAtivosResult.count ?? 0,
    leadsGanhos: leadsGanhosResult.count ?? 0,
    tryonsWeek: tryonsResult.count ?? 0,
    postagensWeek: postagensResult.count ?? 0,
    referralsWeek: referralsResult.count ?? 0,
    urgentLead: urgentLeadResult.data ?? null,
  };
}

export default async function MerchantDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Validar que o usuário tem acesso a esta org
  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org || !isTenantActive(org)) redirect("/merchant");

  const appMeta = user.app_metadata as Record<string, string> | undefined;
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userRole = appMeta?.role ?? userMeta?.role ?? "";
  const userOrgSlug = appMeta?.org_slug ?? userMeta?.org_slug ?? "";

  // Agency pode ver qualquer org; merchant só pode ver a própria
  if (!isAgencyRole(userRole) && userOrgSlug !== slug) {
    redirect("/merchant");
  }

  const stats = await getDashboardData(org.id);
  const orgBase = `/org/${slug}`;
  const displayName = org.name || slug;

  const kpiCards = [
    {
      label: "Leads ativos",
      value: stats.leadsAtivos.toLocaleString("pt-BR"),
      sub: "new + engaged + qualified",
      icon: <Users size={18} className="text-[#D4AF37]" />,
    },
    {
      label: "Ganhos no mês",
      value: stats.leadsGanhos.toLocaleString("pt-BR"),
      sub: "leads convertidos",
      icon: <DollarSign size={18} className="text-[#D4AF37]" />,
    },
    {
      label: "Try-ons esta semana",
      value: stats.tryonsWeek.toLocaleString("pt-BR"),
      sub: "gerações concluídas",
      icon: <Zap size={18} className="text-[#D4AF37]" />,
    },
    {
      label: "Postagens confirmadas",
      value: stats.postagensWeek.toLocaleString("pt-BR"),
      sub: `+ ${stats.referralsWeek} novos via indicação`,
      icon: <Share2 size={18} className="text-[#D4AF37]" />,
    },
  ];

  const navItems = [
    { href: `${orgBase}/dashboard`, icon: <LayoutGrid size={16} />, label: "Executivo", active: true },
    { href: `${orgBase}/catalog`, icon: <ImageIcon size={16} />, label: "Catálogo AI" },
    { href: `${orgBase}/whatsapp/campaigns`, icon: <Activity size={16} />, label: "Performance" },
    { href: `${orgBase}/whatsapp/inbox`, icon: <Users size={16} />, label: "Audiência" },
    { href: `${orgBase}/rewards`, icon: <Share2 size={16} />, label: "Recompensas" },
    { href: `${orgBase}/catalog/new`, icon: <Sparkles size={16} />, label: "Sugestões IA" },
    { href: `${orgBase}/settings`, icon: <Settings size={16} />, label: "Configurações" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full border border-[#D4AF37] flex items-center justify-center overflow-hidden bg-white/5 text-[#D4AF37] font-serif font-bold">
            {org.logo_url ? (
              <img src={org.logo_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <Heading as="h1" className="text-sm tracking-widest uppercase truncate">
            {displayName}
          </Heading>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>

        <div className="p-4 rounded-2xl bg-[#D4AF37]/5 border border-[#D4AF37]/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-xs">
            {user.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-white/80 truncate">
              {userMeta?.name ?? user.email?.split("@")[0] ?? "Operador"}
            </span>
            <span className="text-[8px] text-[#D4AF37] uppercase tracking-widest leading-none">
              {userRole || "store owner"}
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between mb-16 gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-px h-6 bg-[#D4AF37]" />
              <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">
                {displayName} Dashboard
              </Text>
            </div>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">
              Inteligência Operacional
            </Heading>
          </div>

          <div className="flex gap-4">
            <Link
              href={`${orgBase}/catalog`}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all hover:bg-white/5 hover:text-white"
            >
              Ver Catálogo
            </Link>
            <Link
              href={`${orgBase}/catalog/new`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Adicionar Produto
            </Link>
          </div>
        </header>

        {/* Alerta de lead urgente (dados reais) */}
        {stats.urgentLead && (
          <div className="mb-16 animate-in slide-in-from-top-4 duration-700">
            <div className="p-10 rounded-[56px] bg-gradient-to-br from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/30 flex flex-col md:flex-row items-center justify-between gap-10 group hover:border-[#D4AF37]/50 transition-all">
              <div className="flex flex-col md:flex-row items-center gap-10">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif text-3xl font-bold shadow-[0_0_50px_rgba(212,175,55,0.4)] group-hover:scale-110 transition-transform">
                    {stats.urgentLead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-black flex items-center justify-center animate-bounce">
                    <AlertCircle size={10} className="text-white" />
                  </div>
                </div>

                <div className="space-y-4 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                    <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">
                      Alta intenção: {stats.urgentLead.name}
                    </Text>
                  </div>
                  <Heading as="h3" className="text-3xl tracking-tighter uppercase leading-none">
                    Aguardando intervenção humana
                  </Heading>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/60 flex items-center gap-2">
                      <BrainCircuit size={12} className="text-[#D4AF37]" /> Lead em qualified
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[9px] font-bold uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
                      <Activity size={12} /> Mais antigo no funil
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href={`${orgBase}/whatsapp/inbox`}
                className="inline-flex w-full md:w-auto h-20 items-center justify-center rounded-full bg-white px-12 text-[12px] font-bold uppercase tracking-[0.4em] text-black shadow-2xl transition-all hover:scale-105 active:scale-95"
              >
                Assumir conversa e fechar
              </Link>
            </div>
          </div>
        )}

        {/* KPIs reais */}
        <div className="grid grid-cols-4 gap-6 mb-16">
          {kpiCards.map((s) => (
            <div
              key={s.label}
              className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-4 hover:bg-white/[0.05] transition-colors relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                {s.icon}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold tracking-widest text-white/30">{s.label}</span>
                <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                  <ArrowUpRight size={10} /> ao vivo
                </span>
              </div>
              <Heading as="h2" className="text-3xl tracking-tighter">
                {s.value}
              </Heading>
              <Text className="text-[9px] uppercase tracking-widest text-white/20 font-bold">{s.sub}</Text>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-8">
          <section className="col-span-2 space-y-12">
            <div className="space-y-8" id="catalogo-ai">
              <div className="flex items-center justify-between px-2">
                <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
                  Controle de Catálogo AI
                </Heading>
                <Link
                  href={`${orgBase}/catalog`}
                  className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  Gerenciar acervo <ChevronRight size={12} />
                </Link>
              </div>

              <ProductListPlaceholder orgBase={orgBase} />
            </div>

            <div className="space-y-8">
              <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
                Comportamento da Audiência
              </Heading>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-10 rounded-[60px] bg-white/[0.03] border border-white/5 space-y-6">
                  <div className="flex items-center gap-3 text-[#D4AF37]">
                    <Target size={18} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Leads ativos</span>
                  </div>
                  <Heading as="h4" className="text-3xl tracking-tighter">
                    {stats.leadsAtivos.toLocaleString("pt-BR")}
                  </Heading>
                  <Text className="text-xs text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                    new + engaged + qualified
                  </Text>
                </div>

                <div className="p-10 rounded-[60px] bg-white/[0.03] border border-white/5 space-y-6">
                  <div className="flex items-center gap-3 text-[#D4AF37]">
                    <Layers size={18} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Postagens virais</span>
                  </div>
                  <Heading as="h4" className="text-3xl tracking-tighter">
                    {stats.postagensWeek.toLocaleString("pt-BR")}
                  </Heading>
                  <Text className="text-xs text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                    confirmadas esta semana
                  </Text>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-[#D4AF37] font-bold text-center">
              IA Strategic Advisor
            </Heading>

            <div className="p-8 rounded-[48px] bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-[80px] -mr-16 -mt-16" />

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[#D4AF37]">
                  <ShoppingBag size={18} />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Ganhos no mês</span>
                </div>
                <div className="p-6 rounded-3xl bg-black border border-white/5 space-y-2">
                  <span className="text-[9px] uppercase font-bold text-green-500 tracking-widest">
                    {stats.leadsGanhos} lead{stats.leadsGanhos !== 1 ? "s" : ""} convertido{stats.leadsGanhos !== 1 ? "s" : ""}
                  </span>
                  <Heading as="h5" className="text-base tracking-tight leading-tight">
                    Pipeline confirmado este mês
                  </Heading>
                  <Text className="text-[10px] text-white/40 leading-relaxed">
                    Leads fechados com status &quot;won&quot; no período.
                  </Text>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[#D4AF37]">
                  <TrendingUp size={18} />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Loop viral</span>
                </div>
                <div className="p-6 rounded-3xl bg-black border border-white/5 space-y-2">
                  <span className="text-[9px] uppercase font-bold text-[#D4AF37] tracking-widest">
                    {stats.referralsWeek} novo{stats.referralsWeek !== 1 ? "s" : ""} via indicação
                  </span>
                  <Heading as="h5" className="text-base tracking-tight leading-tight">
                    Usuários captados por link de postagem
                  </Heading>
                  <Text className="text-[10px] text-white/40 leading-relaxed">Últimos 7 dias</Text>
                </div>
              </div>

              <Link
                href={`${orgBase}/catalog/new`}
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-6 text-[10px] font-bold uppercase tracking-[0.3em] text-black shadow-2xl transition-all hover:bg-white/90 active:scale-95"
              >
                Ativar otimizações IA
              </Link>
            </div>

            <div className="p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-4">
              <div className="flex items-center gap-3 text-white/40">
                <PieChart size={18} />
                <span className="text-[9px] uppercase font-bold tracking-widest">Try-ons esta semana</span>
              </div>
              <Heading as="h4" className="text-3xl tracking-tighter text-[#D4AF37]">
                {stats.tryonsWeek.toLocaleString("pt-BR")}
              </Heading>
              <Text className="text-[9px] uppercase tracking-widest text-white/20 font-bold">gerações concluídas</Text>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${
        active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}

function ProductListPlaceholder({ orgBase }: { orgBase: string }) {
  const placeholders = [
    { idx: 0, action: "edit" },
    { idx: 1, action: "view" },
    { idx: 2, action: "view" },
  ];

  return (
    <div className="space-y-4">
      {placeholders.map(({ idx, action }) => (
        <div
          key={idx}
          className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-between gap-8 hover:bg-white/[0.04] transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center">
            <ImageIcon size={20} className="text-white/20" />
          </div>

          <div className="flex flex-col flex-1">
            <Heading as="h4" className="text-base tracking-tight uppercase leading-none mb-1 text-white/40">
              Produto {idx + 1}
            </Heading>
            <span className="text-[9px] uppercase tracking-widest text-white/20 font-bold">
              Acessar catálogo para ver detalhes
            </span>
          </div>

          <div className="flex items-center gap-4">
            {action === "edit" ? (
              <Link
                href={`${orgBase}/catalog/new`}
                className="inline-flex p-3 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 active:scale-95 transition-all"
              >
                <Edit3 size={16} />
              </Link>
            ) : (
              <Link
                href={`${orgBase}/catalog`}
                className="inline-flex p-3 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Eye size={16} />
              </Link>
            )}
            <Link
              href={`${orgBase}/catalog`}
              className="inline-flex p-3 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus size={16} />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
