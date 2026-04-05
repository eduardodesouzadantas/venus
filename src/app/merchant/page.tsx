import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { fetchTenantBySlug, isAgencyRole, isTenantActive, resolveTenantContext } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

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
            A loja <strong className="text-white">{tenant.org.name}</strong> está com status{" "}
            <strong>{statusLabel}</strong>. O acesso ao workspace foi suspenso pelo núcleo de controle.
          </Text>
          <Link href="/b2b/login">
            <VenusButton variant="solid">Voltar ao Login</VenusButton>
          </Link>
        </GlassContainer>
      </div>
    );
  }

  redirect(`/org/${tenant.org.slug}/dashboard`);
}
