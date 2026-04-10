import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Role } from "@/types/hardened";

export type TenantStatus = "active" | "suspended" | "blocked";
export type TenantPlan = "freemium" | "free" | "starter" | "pro" | "growth" | "scale" | "enterprise";
export type TenantSource = "merchant_provision" | "merchant_backfill" | "system";

export interface TenantLimits {
  ai_tokens_monthly: number;
  whatsapp_messages_daily: number;
  products: number;
  leads: number;
}

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  whatsapp_number?: string | null;
  status: TenantStatus;
  kill_switch: boolean;
  plan_id: TenantPlan | string;
  limits: TenantLimits | Record<string, unknown>;
  owner_user_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TenantMemberRecord {
  id?: string;
  org_id: string;
  user_id: string;
  role: Role | string;
  status: "active" | "invited" | "suspended" | "blocked";
  created_at?: string;
  updated_at?: string;
}

export interface TenantContext {
  orgSlug: string | null;
  orgId: string | null;
  role: string | null;
  email: string | null;
  name: string | null;
}

export interface TenantProvisionInput {
  orgSlug: string;
  orgName?: string;
  ownerUserId?: string | null;
  role?: Role | string;
  planId?: TenantPlan | string;
  status?: TenantStatus;
  limits?: Partial<TenantLimits> | null;
  source?: TenantSource;
}

export interface CurrentMerchantOrgContext {
  user: User;
  org: TenantRecord;
  member: TenantMemberRecord;
  role: string;
}

export interface ResolvedAppTenantContext {
  org: TenantRecord | null;
  source: "merchant_auth" | "explicit_slug" | "single_active_org" | "none";
}

export const DEFAULT_TENANT_LIMITS: TenantLimits = {
  ai_tokens_monthly: 250_000,
  whatsapp_messages_daily: 1_000,
  products: 500,
  leads: 10_000,
};

const ORG_SELECT_COLUMNS =
  "id, slug, name, logo_url, primary_color, whatsapp_number, status, kill_switch, plan_id, limits, owner_user_id, created_at, updated_at";
const ORG_MEMBER_SELECT_COLUMNS = "id, org_id, user_id, role, status, created_at, updated_at";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTenantSlug(value?: string | null) {
  const raw = normalizeString(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return raw.replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function readMetadata(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = normalizeString(metadata?.[key]);
    if (value) return value;
  }
  return "";
}

export function resolveTenantContext(user?: Pick<User, "email" | "app_metadata" | "user_metadata"> | null): TenantContext {
  if (!user) {
    return { orgSlug: null, orgId: null, role: null, email: null, name: null };
  }

  const appMetadata = user.app_metadata as Record<string, unknown> | undefined;
  const userMetadata = user.user_metadata as Record<string, unknown> | undefined;

  const orgSlug = normalizeTenantSlug(
    readMetadata(appMetadata, ["org_slug", "orgId", "org_id"]) ||
      readMetadata(userMetadata, ["org_slug", "orgId", "org_id"])
  );

  const orgId = normalizeString(
    readMetadata(appMetadata, ["org_id", "orgId", "org_slug"]) ||
      readMetadata(userMetadata, ["org_id", "orgId", "org_slug"])
  );

  return {
    orgSlug: orgSlug || null,
    orgId: orgId || null,
    role:
      readMetadata(appMetadata, ["role", "tenant_role"]) ||
      readMetadata(userMetadata, ["role", "tenant_role"]) ||
      null,
    email: normalizeString(user.email) || null,
    name:
      readMetadata(userMetadata, ["name"]) ||
      normalizeString(user.email?.split("@")[0]) ||
      null,
  };
}

export function isMerchantRole(role?: string | null) {
  return normalizeString(role).startsWith("merchant_");
}

export function isAgencyRole(role?: string | null) {
  return normalizeString(role).startsWith("agency_");
}

export function isTenantActive(record?: Pick<TenantRecord, "status" | "kill_switch"> | null) {
  if (!record) {
    return false;
  }

  return record.status === "active" && !record.kill_switch;
}

export async function fetchTenantBySlug(supabase: SupabaseClient, slug: string) {
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) {
    return { org: null as TenantRecord | null, error: null as Error | null };
  }

  const { data, error } = await supabase
    .from("orgs")
    .select(ORG_SELECT_COLUMNS)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error) {
    return { org: null as TenantRecord | null, error };
  }

  return { org: (data as TenantRecord | null) ?? null, error: null };
}

export async function fetchTenantById(supabase: SupabaseClient, id: string) {
  const normalizedId = normalizeString(id);
  if (!normalizedId) {
    return { org: null as TenantRecord | null, error: null as Error | null };
  }

  const { data, error } = await supabase
    .from("orgs")
    .select(ORG_SELECT_COLUMNS)
    .eq("id", normalizedId)
    .maybeSingle();

  if (error) {
    return { org: null as TenantRecord | null, error };
  }

  return { org: (data as TenantRecord | null) ?? null, error: null };
}

export async function fetchMerchantMembership(
  supabase: SupabaseClient,
  userId: string,
  orgId?: string | null
) {
  const normalizedUserId = normalizeString(userId);
  const normalizedOrgId = normalizeString(orgId);

  let query = supabase
    .from("org_members")
    .select(ORG_MEMBER_SELECT_COLUMNS)
    .eq("user_id", normalizedUserId);

  if (normalizedOrgId) {
    query = query.eq("org_id", normalizedOrgId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { member: null as TenantMemberRecord | null, error };
  }

  return { member: (data as TenantMemberRecord | null) ?? null, error: null };
}

export async function resolveCurrentMerchantOrg(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null as User | null, org: null as TenantRecord | null, member: null as TenantMemberRecord | null, error: "Missing Supabase auth session" };
  }

  const context = resolveTenantContext(user);
  let org: TenantRecord | null = null;
  let orgError: Error | null = null;

  if (context.orgSlug) {
    const result = await fetchTenantBySlug(supabase, context.orgSlug);
    org = result.org;
    orgError = result.error;
  }

  if (!org) {
    const { data: memberships, error: membershipError } = await supabase
      .from("org_members")
      .select(ORG_MEMBER_SELECT_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (membershipError) {
      return { user, org: null, member: null, error: membershipError.message };
    }

    const firstMembership = memberships?.[0] as TenantMemberRecord | undefined;
    if (firstMembership) {
      const orgById = await fetchTenantById(supabase, firstMembership.org_id);
      org = orgById.org;
      orgError = orgById.error;
      if (org) {
        return {
          user,
          org,
          member: firstMembership,
          role: firstMembership.role,
          error: null as string | null,
        };
      }
    }
  }

  if (!org) {
    return { user, org: null, member: null, error: orgError?.message || "Merchant tenant not found" };
  }

  const { member, error: memberError } = await fetchMerchantMembership(supabase, user.id, org.id);
  if (memberError && memberError.message) {
    return { user, org, member: null, error: memberError.message };
  }

  if (!member) {
    return { user, org, member: null, error: "Merchant membership not found" };
  }

  return {
    user,
    org,
    member,
    role: member.role,
    error: null as string | null,
  };
}

export async function resolveAppTenantOrg(
  supabase: SupabaseClient,
  options: {
    preferredSlug?: string | null;
    allowSingleActiveFallback?: boolean;
  } = {}
): Promise<ResolvedAppTenantContext> {
  const preferredSlug = normalizeTenantSlug(options.preferredSlug);

  if (preferredSlug) {
    const result = await fetchTenantBySlug(supabase, preferredSlug);
    if (result.org) {
      return { org: result.org, source: "explicit_slug" };
    }
  }

  const merchantResolved = await resolveCurrentMerchantOrg(supabase);
  if (!merchantResolved.error && merchantResolved.org && isMerchantRole(merchantResolved.role)) {
    return { org: merchantResolved.org, source: "merchant_auth" };
  }

  if (options.allowSingleActiveFallback === false) {
    return { org: null, source: "none" };
  }

  const { data, error } = await supabase
    .from("orgs")
    .select(ORG_SELECT_COLUMNS)
    .eq("status", "active")
    .eq("kill_switch", false)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error || !data || data.length !== 1) {
    return { org: null, source: "none" };
  }

  return { org: data[0] as TenantRecord, source: "single_active_org" };
}

export async function assertMerchantWritableOrgAccess(
  supabase: SupabaseClient
): Promise<CurrentMerchantOrgContext> {
  const resolved = await resolveCurrentMerchantOrg(supabase);

  if (resolved.error || !resolved.user || !resolved.org || !resolved.member) {
    throw new Error(resolved.error || "Merchant org access denied");
  }

  if (!isTenantActive(resolved.org)) {
    throw new Error(`Tenant ${resolved.org.slug} is not active`);
  }

  const role = normalizeString(resolved.member.role);
  const writableRoles = new Set(["merchant_owner", "merchant_manager", "merchant_editor"]);

  if (!writableRoles.has(role)) {
    throw new Error(`Role ${role || "unknown"} cannot write catalog`);
  }

  if (resolved.member.status !== "active") {
    throw new Error(`Merchant membership is ${resolved.member.status}`);
  }

  return resolved as CurrentMerchantOrgContext;
}

export async function ensureTenantCoreRecords(
  supabase: SupabaseClient,
  input: TenantProvisionInput
): Promise<{ org: TenantRecord; member: TenantMemberRecord | null }> {
  const slug = normalizeTenantSlug(input.orgSlug);
  if (!slug) {
    throw new Error("Missing org slug");
  }

  const orgPayload: Record<string, unknown> = {
    slug,
    name: normalizeString(input.orgName) || slug,
    status: input.status || "active",
    kill_switch: false,
    plan_id: normalizeString(input.planId) || "starter",
    limits: {
      ...DEFAULT_TENANT_LIMITS,
      ...(input.limits || {}),
    },
    ...(input.ownerUserId ? { owner_user_id: input.ownerUserId } : {}),
  };

  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .upsert(orgPayload, { onConflict: "slug" })
    .select(ORG_SELECT_COLUMNS)
    .single();

  if (orgError || !org) {
    throw new Error(`Failed to upsert org ${slug}: ${orgError?.message || "unknown error"}`);
  }

  let member: TenantMemberRecord | null = null;

  if (input.ownerUserId) {
    const memberPayload: Record<string, unknown> = {
      org_id: org.id,
      user_id: input.ownerUserId,
      role: normalizeString(input.role) || "merchant_owner",
      status: "active",
    };

    const { data: memberData, error: memberError } = await supabase
      .from("org_members")
      .upsert(memberPayload, { onConflict: "org_id,user_id" })
      .select(ORG_MEMBER_SELECT_COLUMNS)
      .single();

    if (memberError || !memberData) {
      throw new Error(`Failed to upsert org member for ${slug}: ${memberError?.message || "unknown error"}`);
    }

    member = memberData as TenantMemberRecord;
  }

  const usageDate = new Date().toISOString().slice(0, 10);
  await supabase.from("org_usage_daily").upsert(
    {
      org_id: org.id,
      usage_date: usageDate,
      ai_tokens: 0,
      ai_requests: 0,
      messages_sent: 0,
      events_count: 0,
      revenue_cents: 0,
      cost_cents: 0,
    },
    { onConflict: "org_id,usage_date" }
  );

  await supabase.from("tenant_events").upsert(
    {
      org_id: org.id,
      actor_user_id: input.ownerUserId || null,
      event_type: input.source === "merchant_backfill" ? "tenant_backfilled" : "tenant_provisioned",
      event_source: input.source || "system",
      dedupe_key: `tenant:${input.source || "system"}:${slug}:${input.ownerUserId || "system"}`,
      payload: {
        org_slug: slug,
        org_name: org.name,
        plan_id: org.plan_id,
        role: normalizeString(input.role) || "merchant_owner",
      },
    },
    { onConflict: "dedupe_key" }
  );

  return { org: org as TenantRecord, member };
}

export async function bumpTenantUsageDaily(
  supabase: SupabaseClient,
  orgId: string,
  delta: Partial<{
    ai_tokens: number;
    ai_requests: number;
    messages_sent: number;
    events_count: number;
    revenue_cents: number;
    cost_cents: number;
    leads: number;
  }> = {}
) {
  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) {
    return;
  }

  const usageDate = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("org_usage_daily")
    .select("ai_tokens, ai_requests, messages_sent, events_count, revenue_cents, cost_cents, leads")
    .eq("org_id", normalizedOrgId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  const current = {
    ai_tokens: Number(existing?.ai_tokens || 0),
    ai_requests: Number(existing?.ai_requests || 0),
    messages_sent: Number(existing?.messages_sent || 0),
    events_count: Number(existing?.events_count || 0),
    revenue_cents: Number(existing?.revenue_cents || 0),
    cost_cents: Number(existing?.cost_cents || 0),
    leads: Number((existing as Record<string, unknown> | undefined)?.leads || 0),
  };

  await supabase.from("org_usage_daily").upsert(
    {
      org_id: normalizedOrgId,
      usage_date: usageDate,
      ai_tokens: current.ai_tokens + Number(delta.ai_tokens || 0),
      ai_requests: current.ai_requests + Number(delta.ai_requests || 0),
      messages_sent: current.messages_sent + Number(delta.messages_sent || 0),
      events_count: current.events_count + Number(delta.events_count || 0),
      revenue_cents: current.revenue_cents + Number(delta.revenue_cents || 0),
      cost_cents: current.cost_cents + Number(delta.cost_cents || 0),
      leads: current.leads + Number((delta as { leads?: number }).leads || 0),
    },
    { onConflict: "org_id,usage_date" }
  );
}
