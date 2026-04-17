import { redirect } from "next/navigation";
import { TenantResolutionFallbackScreen } from "@/components/onboarding/public-surface";
import { CANONICAL_PUBLIC_TENANT_SLUG, resolvePublicEntryTenant } from "@/lib/onboarding/public-entry";
import { normalizeTenantSlug } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

export default async function IndexRouter({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const requestedOrg = normalizeTenantSlug(
    typeof resolved.org === "string" ? resolved.org : Array.isArray(resolved.org) ? resolved.org[0] || "" : ""
  );

  const tenant = await resolvePublicEntryTenant(requestedOrg || CANONICAL_PUBLIC_TENANT_SLUG);
  if (tenant) {
    redirect(`/onboarding/chat?org=${tenant.slug}`);
  }

  return (
    <TenantResolutionFallbackScreen
      title="Não consegui identificar a loja desta experiência."
      message="A entrada pública precisa começar com uma loja ativa. Volte para a entrada segura e tente novamente."
      actionHref="/"
      actionLabel="Tentar novamente"
    />
  );
}
