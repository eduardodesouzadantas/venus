import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchTenantBySlug,
  isAgencyRole,
  isMerchantRole,
  isTenantActive,
  normalizeTenantSlug,
  resolveTenantContext,
  type TenantMemberRecord,
  type TenantRecord,
} from "@/lib/tenant/core";

const MERCHANT_WRITE_ROLES = new Set(["merchant_owner", "merchant_manager", "merchant_editor"]);

export interface MerchantOrgAccess {
  user: User;
  org: TenantRecord;
  member: TenantMemberRecord | null;
  role: string;
  source: "merchant" | "agency";
}

function assertMemberCanWrite(member: TenantMemberRecord | null) {
  if (!member) {
    throw new Error("Merchant membership not found");
  }

  const role = String(member.role || "").trim();
  if (!MERCHANT_WRITE_ROLES.has(role)) {
    throw new Error(`Role ${role || "unknown"} cannot manage store settings`);
  }

  if (member.status !== "active") {
    throw new Error(`Merchant membership is ${member.status}`);
  }
}

export async function resolveMerchantOrgAccess(slug: string): Promise<MerchantOrgAccess> {
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) {
    throw new Error("Missing org slug");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const context = resolveTenantContext(user);
  const admin = createAdminClient();

  if (isAgencyRole(context.role)) {
    const { data: org, error } = await admin
      .from("orgs")
      .select(
        "id, slug, name, logo_url, primary_color, whatsapp_number, status, kill_switch, plan_id, limits, owner_user_id, created_at, updated_at"
      )
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!org) {
      throw new Error("Org not found");
    }

    return {
      user,
      org: org as TenantRecord,
      member: null,
      role: context.role || "agency_owner",
      source: "agency",
    };
  }

  if (!isMerchantRole(context.role) || context.orgSlug !== normalizedSlug) {
    throw new Error("Forbidden");
  }

  const { org, error: orgError } = await fetchTenantBySlug(supabase, normalizedSlug);
  if (orgError) {
    throw new Error(orgError.message);
  }

  if (!org) {
    throw new Error("Org not found");
  }

  if (!isTenantActive(org)) {
    throw new Error(`Tenant ${org.slug} is not active`);
  }

  const { data: member, error: memberError } = await supabase
    .from("org_members")
    .select("id, org_id, user_id, role, status, created_at, updated_at")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  assertMemberCanWrite(member as TenantMemberRecord | null);

  return {
    user,
    org,
    member: (member as TenantMemberRecord | null) ?? null,
    role: String(member?.role || ""),
    source: "merchant",
  };
}
