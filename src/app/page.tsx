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

  if (requestedOrg) {
    redirect(`/onboarding/chat?org=${requestedOrg}`);
  }

  redirect("/onboarding/chat");
}
