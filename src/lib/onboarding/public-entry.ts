import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isTenantActive, normalizeTenantSlug, type TenantRecord } from "@/lib/tenant/core";

export const CANONICAL_PUBLIC_TENANT_SLUG = "maison-elite";

export type PublicEntryTenant = Pick<
  TenantRecord,
  "id" | "slug" | "name" | "branch_name" | "logo_url" | "primary_color" | "status" | "kill_switch"
>;

async function fetchPublicEntryTenantBySlug(slug: string): Promise<PublicEntryTenant | null> {
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orgs")
    .select("id, slug, name, branch_name, logo_url, primary_color, status, kill_switch")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error || !data || !isTenantActive(data as Pick<TenantRecord, "status" | "kill_switch">)) {
    return null;
  }

  return data as PublicEntryTenant;
}

export async function resolvePublicEntryTenant(requestedSlug?: string | null) {
  const normalizedRequestedSlug = normalizeTenantSlug(requestedSlug);
  if (normalizedRequestedSlug) {
    return fetchPublicEntryTenantBySlug(normalizedRequestedSlug);
  }

  return fetchPublicEntryTenantBySlug(CANONICAL_PUBLIC_TENANT_SLUG);
}
