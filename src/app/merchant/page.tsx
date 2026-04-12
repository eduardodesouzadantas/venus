import Link from "next/link";
import { redirect } from "next/navigation";

import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isTenantActive, resolveTenantContext } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type DashboardStats = {
  leadsAtivos: number;
  leadsGanhos: number;
  tryonsWeek: number;
  postagensWeek: number;
  referralsWeek: number;
  urgentLead: { name: string } | null;
};

type MerchantBranchRecord = {
  id: string;
  slug: string;
  name: string;
  branch_name: string | null;
  whatsapp_number: string | null;
  status: string;
  kill_switch: boolean;
  plan_id: string | null;
  group_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner_user_id: string | null;
};

type MerchantGroupRecord = {
  id: string;
  name: string;
  owner_user_id: string;
  org_id: string;
  created_at: string | null;
};

async function getDashboardData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<DashboardStats> {
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

async function getGroupPanelData(supabase: Awaited<ReturnType<typeof createClient>>, groupId: string, ownerUserId: string) {
  const [{ data: group }, { data: branches }] = await Promise.all([
    supabase
      .from("merchant_groups")
      .select("id, name, owner_user_id, org_id, created_at")
      .eq("id", groupId)
      .maybeSingle<MerchantGroupRecord>(),
    supabase
      .from("orgs")
      .select("id, slug, name, branch_name, whatsapp_number, status, kill_switch, plan_id, group_id, created_at, updated_at, owner_user_id")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true }),
  ]);

  if (!group || group.owner_user_id !== ownerUserId) {
    return { group: null as MerchantGroupRecord | null, branches: [] as MerchantBranchRecord[] };
  }

  return {
    group,
    branches: (branches || []) as MerchantBranchRecord[],
  };
}

function sumStats(values: DashboardStats[]): DashboardStats {
  return values.reduce<DashboardStats>(
    (acc, current) => ({
      leadsAtivos: acc.leadsAtivos + current.leadsAtivos,
      leadsGanhos: acc.leadsGanhos + current.leadsGanhos,
      tryonsWeek: acc.tryonsWeek + current.tryonsWeek,
      postagensWeek: acc.postagensWeek + current.postagensWeek,
      referralsWeek: acc.referralsWeek + current.referralsWeek,
      urgentLead: acc.urgentLead || current.urgentLead,
    }),
    {
      leadsAtivos: 0,
      leadsGanhos: 0,
      tryonsWeek: 0,
      postagensWeek: 0,
      referralsWeek: 0,
      urgentLead: null,
    }
  );
}

function panelLabel(branch: MerchantBranchRecord) {
  return branch.branch_name || branch.name || branch.slug;
}

export default async function MerchantEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/b2b/login");
  }

  const tenantContext = resolveTenantContext(user);

  if (tenantContext.role && isAgencyRole(tenantContext.role)) {
    redirect("/agency");
  }

  if (!tenantContext.orgSlug) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <GlassContainer className="w-full max-w-xl space-y-6">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase tracking-[0.4em] text-white/40">Merchant Entry</Text>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase">
              Tenant não encontrado
            </Heading>
          </div>
          <Text className="text-sm text-white/60 leading-relaxed">
            Sua sessão está autenticada, mas ainda não existe metadata canônica de loja para abrir o workspace.
          </Text>
          <Link href="/b2b/login">
            <VenusButton variant="solid">Voltar ao Login</VenusButton>
          </Link>
        </GlassContainer>
      </div>
    );
  }

  const tenant = await fetchTenantBySlug(supabase, tenantContext.orgSlug);

  if (!tenant.org) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <GlassContainer className="w-full max-w-xl space-y-6">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase tracking-[0.4em] text-white/40">Merchant Entry</Text>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase">
              Loja não provisionada
            </Heading>
          </div>
          <Text className="text-sm text-white/60 leading-relaxed">
            Encontramos a sessão do lojista, mas o tenant canônico ainda não foi criado ou sincronizado.
          </Text>
          <Link href="/b2b/login">
            <VenusButton variant="solid">Voltar ao Login</VenusButton>
          </Link>
        </GlassContainer>
      </div>
    );
  }

  if (!isTenantActive(tenant.org)) {
    const statusLabel = tenant.org.kill_switch ? "Kill switch ativo" : tenant.org.status;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <GlassContainer className="w-full max-w-xl space-y-6">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase tracking-[0.4em] text-white/40">Merchant Entry</Text>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase">
              Acesso bloqueado
            </Heading>
          </div>
          <Text className="text-sm text-white/60 leading-relaxed">
            A loja <strong className="text-white">{tenant.org.name}</strong> está com status <strong>{statusLabel}</strong>. O acesso ao workspace foi suspenso pelo núcleo de controle.
          </Text>
          <Link href="/b2b/login">
            <VenusButton variant="solid">Voltar ao Login</VenusButton>
          </Link>
        </GlassContainer>
      </div>
    );
  }

  if (!tenant.org.group_id) {
    redirect(`/org/${tenant.org.slug}/dashboard`);
  }

  const { group, branches } = await getGroupPanelData(supabase, tenant.org.group_id, user.id);
  if (!group || branches.length === 0) {
    redirect(`/org/${tenant.org.slug}/dashboard`);
  }

  const branchStats = await Promise.all(branches.map((branch) => getDashboardData(supabase, branch.id)));
  const summary = sumStats(branchStats);
  const currentBranch = branches.find((branch) => branch.slug === tenant.org?.slug) || branches[0];
  const currentBranchLabel = currentBranch ? panelLabel(currentBranch) : tenant.org.branch_name || tenant.org.name || tenant.org.slug;
  const orgBase = `/org/${currentBranch?.slug || tenant.org.slug}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-6 pt-10 pb-8 border-b border-white/5 sticky top-0 z-40 bg-black/80 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase font-bold tracking-[0.5em] text-[#C9A84C]">Merchant Group</Text>
            <Heading as="h1" className="text-3xl uppercase tracking-tighter">
              {group.name}
            </Heading>
            <Text className="text-sm text-white/50 max-w-2xl">
              Painel consolidado com todas as filiais, troca sem logout e acesso direto ao catálogo de cada unidade.
            </Text>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.3em] font-bold border bg-white/5 text-white/70 border-white/10">
              {branches.length} filiais
            </span>
            <Link href="/merchant">
              <VenusButton variant="outline" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold border-white/10">
                Atualizar grupo
              </VenusButton>
            </Link>
            <Link href={`${orgBase}/catalog/new`}>
              <VenusButton variant="solid" className="h-12 px-6 rounded-full uppercase tracking-[0.35em] text-[9px] font-bold bg-white text-black">
                Cadastrar produto na filial
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>

      <main className="px-6 py-8 space-y-10">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Leads ativos" value={summary.leadsAtivos} />
          <SummaryCard label="Ganhos no mês" value={summary.leadsGanhos} />
          <SummaryCard label="Try-ons na semana" value={summary.tryonsWeek} />
          <SummaryCard label="Postagens confirmadas" value={summary.postagensWeek} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Indicações" value={summary.referralsWeek} />
          <SummaryCard label="Filiais com alerta" value={branchStats.filter((stat) => stat.urgentLead).length} />
          <SummaryCard label="Total de filiais" value={branches.length} />
          <SummaryCard label="Filial ativa" value={currentBranchLabel} />
        </section>

        {summary.urgentLead && (
          <div className="rounded-[32px] border border-[#C9A84C]/20 bg-[#C9A84C]/10 p-6">
            <Text className="text-[10px] uppercase tracking-[0.35em] text-[#C9A84C]">Lead urgente</Text>
            <Heading as="h2" className="mt-2 text-2xl uppercase tracking-tighter">
              {summary.urgentLead.name}
            </Heading>
            <Text className="mt-2 text-sm text-white/70">
              A fila consolidada encontrou um lead qualificado aguardando ação humana.
            </Text>
          </div>
        )}

        <section className="space-y-4">
          <Heading as="h2" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
            Filiais do grupo
          </Heading>
          <div className="grid gap-4 xl:grid-cols-2">
            {branches.map((branch, index) => {
              const stats = branchStats[index];
              const isActive = branch.slug === currentBranch?.slug;

              return (
                <div
                  key={branch.id}
                  className={`rounded-[32px] border p-5 space-y-5 ${
                    isActive ? "border-[#C9A84C]/30 bg-[#C9A84C]/8" : "border-white/5 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Heading as="h3" className="text-2xl tracking-tight">
                          {panelLabel(branch)}
                        </Heading>
                        {isActive && (
                          <span className="px-2.5 py-1 rounded-full text-[8px] uppercase tracking-[0.28em] font-bold border bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20">
                            Atual
                          </span>
                        )}
                      </div>
                      <Text className="text-[10px] uppercase tracking-[0.3em] text-white/35">
                        slug: {branch.slug} • catálogo isolado • WhatsApp: {branch.whatsapp_number || "não definido"}
                      </Text>
                      <Text className="text-sm text-white/55">
                        {branch.branch_name || branch.name} dentro do grupo {group.name}.
                      </Text>
                    </div>

                    <div className="grid grid-cols-2 gap-3 min-w-[220px]">
                      <MiniStat label="Leads" value={stats.leadsAtivos} />
                      <MiniStat label="Ganhos" value={stats.leadsGanhos} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href={`/org/${branch.slug}/dashboard`}>
                      <VenusButton variant="solid" className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium bg-white text-black">
                        Abrir filial
                      </VenusButton>
                    </Link>
                    <Link href={`/org/${branch.slug}/catalog/new`}>
                      <VenusButton variant="outline" className="h-11 px-5 rounded-full tracking-[0.08em] text-[9px] font-medium border-white/10">
                        Novo produto
                      </VenusButton>
                    </Link>
                    <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
                      {branch.status}{branch.kill_switch ? " • kill switch" : ""}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[8px] tracking-[0.08em] font-medium border bg-white/5 text-white/70 border-white/10">
                      {branch.plan_id || "sem plano"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-5 rounded-[28px] bg-white/[0.03] border border-white/5 space-y-2">
      <Text className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-bold">{label}</Text>
      <Heading as="h3" className="text-2xl tracking-tighter">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </Heading>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/30 p-3 text-center">
      <div className="text-[10px] font-medium tracking-[0.08em] text-white/35">{label}</div>
      <div className="mt-1 text-xl tracking-tight">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
