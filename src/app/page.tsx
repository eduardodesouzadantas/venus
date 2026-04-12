import { redirect } from "next/navigation";
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

  // Se houver uma organização (cliente final chegando pelo link da loja)
  if (requestedOrg) {
    // Redireciona para o Splash com o parâmetro da organização
    redirect(`/onboarding/chat?org=${requestedOrg}`);
  }

  // Se não houver organização (visitante comum ou lojista via link de vendas)
  // Redireciona para a landing page de apresentação
  redirect("/para-lojistas");
}
