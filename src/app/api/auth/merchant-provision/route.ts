import { NextResponse } from "next/server";
import { sendMerchantWelcomeEmail, type MerchantWelcomeEmailResult } from "@/lib/email/welcome";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureTenantCoreRecords,
  fetchMerchantGroupById,
  fetchTenantBySlug,
  isAgencyRole,
  normalizeTenantSlug,
  resolveTenantContext,
} from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type RequestBody = {
  email?: string;
  password?: string;
  org_slug?: string;
  org_id?: string;
  role?: string;
  name?: string;
  plan_id?: string;
  agency_org_id?: string;
  provision_mode?: string;
  branch_mode?: string;
  branch_name?: string;
  merchant_group_id?: string;
  merchant_group_name?: string;
  whatsapp_number?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalOrg(body: RequestBody) {
  return normalizeTenantSlug(body.org_slug || body.org_id);
}

function isMerchantRole(role: string) {
  return role.startsWith("merchant_");
}

function normalizePlanId(value: unknown) {
  const normalized = normalize(value).toLowerCase();
  if (normalized === "freemium" || normalized === "starter" || normalized === "pro" || normalized === "enterprise") {
    return normalized;
  }
  return "";
}

async function resolveCallerAgencyOrgId(fallbackOrgId?: string | null) {
  const normalizedFallback = normalize(fallbackOrgId);
  let callerOrgId = normalizedFallback || null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const context = resolveTenantContext(user);
      if (isAgencyRole(context.role) && context.orgId) {
        callerOrgId = context.orgId;
      }
    }
  } catch {
    // If no session is present we fall back to the explicit body value.
  }

  return callerOrgId;
}

function planLabel(planId: string) {
  switch (planId) {
    case "freemium":
      return "Freemium - 15 dias";
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "enterprise":
      return "Enterprise";
    default:
      return planId;
  }
}

export async function POST(request: Request) {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = normalize(body.email);
  const password = normalize(body.password);
  const orgSlug = canonicalOrg(body);
  const role = normalize(body.role) || "merchant_owner";
  const name = normalize(body.name);
  const planId = normalizePlanId(body.plan_id) || "freemium";
  const branchName = normalize(body.branch_name);
  const provisionMode = normalize(body.provision_mode) || "independent";
  const branchMode = normalize(body.branch_mode) || "existing";
  const merchantGroupId = normalize(body.merchant_group_id);
  const merchantGroupName = normalize(body.merchant_group_name);
  const whatsappNumber = normalize(body.whatsapp_number);
  const agencyOrgId = await resolveCallerAgencyOrgId(body.agency_org_id);

  if (!email || !password || !orgSlug) {
    return NextResponse.json({ error: "Missing merchant bootstrap data" }, { status: 400 });
  }

  if (!isMerchantRole(role)) {
    return NextResponse.json({ error: "Unsupported role" }, { status: 403 });
  }

  if (provisionMode === "branch" && !agencyOrgId) {
    return NextResponse.json({ error: "Missing agency org context for group provisioning" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: "Supabase service role unavailable", details: String(error) },
      { status: 503 }
    );
  }

  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const existing = usersPage.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;

  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })
    : await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

  if (result.error || !result.data.user) {
    return NextResponse.json({ error: result.error?.message || "Could not provision merchant" }, { status: 500 });
  }

  let merchantGroupRecord: { id: string; name: string; owner_user_id: string; org_id: string; created_at?: string | null } | null = null;

  try {

    if (provisionMode === "branch") {
      if (branchMode === "new") {
        const groupName = merchantGroupName || name || orgSlug;
        const { data: groupData, error: groupError } = await admin
          .from("merchant_groups")
          .insert({
            name: groupName,
            owner_user_id: result.data.user.id,
            org_id: agencyOrgId,
          })
          .select("id, name, owner_user_id, org_id, created_at")
          .single();

        if (groupError || !groupData) {
          throw new Error(`Failed to create merchant group: ${groupError?.message || "unknown error"}`);
        }

        merchantGroupRecord = groupData;
      } else {
        if (!merchantGroupId) {
          throw new Error("Missing merchant group id");
        }

        const { group, error: groupError } = await fetchMerchantGroupById(admin, merchantGroupId);
        if (groupError || !group) {
          throw new Error(groupError?.message || "Merchant group not found");
        }

        if (group.org_id !== agencyOrgId) {
          throw new Error("Merchant group does not belong to the current agency");
        }

        merchantGroupRecord = group;
      }
    }

    const tenantCore = await ensureTenantCoreRecords(admin, {
      orgSlug,
      orgName: name || result.data.user.email || orgSlug,
      groupId: provisionMode === "branch" ? merchantGroupRecord?.id || merchantGroupId || null : null,
      branchName: branchName || name || orgSlug,
      ownerUserId: result.data.user.id,
      role,
      planId,
      source: "merchant_provision",
    });

    const canonicalMetadata = {
      org_slug: orgSlug,
      org_id: tenantCore.org.id,
      role,
      plan_id: planId,
      tenant_source: "merchant_provision",
      branch_name: branchName || name || orgSlug,
    };

    const canonicalUserMetadata = {
      email,
      name: name || email.split("@")[0],
      org_slug: orgSlug,
      org_id: tenantCore.org.id,
      role,
      plan_id: planId,
      branch_name: branchName || name || orgSlug,
    };

    await admin.auth.admin.updateUserById(result.data.user.id, {
      app_metadata: canonicalMetadata,
      user_metadata: canonicalUserMetadata,
    });

    const loginUrl = new URL("/b2b/login", request.url).toString();
    if (whatsappNumber) {
      const { error: whatsappError } = await admin
        .from("orgs")
        .update({ whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
        .eq("id", tenantCore.org.id);

      if (whatsappError) {
        throw new Error(`Failed to update org WhatsApp: ${whatsappError.message}`);
      }
    }

    let welcomeEmail: MerchantWelcomeEmailResult = {
      sent: false,
      provider: "none" as const,
      message: "Resend not configured",
    };

    try {
      welcomeEmail = await sendMerchantWelcomeEmail({
        to: result.data.user.email || email,
        storeName: tenantCore.org.name,
        slug: tenantCore.org.slug,
        email: result.data.user.email || email,
        password,
        planLabel: planLabel(planId),
        loginUrl,
      });
    } catch (error) {
      welcomeEmail = {
        sent: false,
        provider: "none",
        message: error instanceof Error ? error.message : "Failed to send welcome email",
      };
    }

    return NextResponse.json(
      {
        ok: true,
        user_id: result.data.user.id,
        email: result.data.user.email,
        org_slug: orgSlug,
        org_id: tenantCore.org.id,
        tenant_org_id: tenantCore.org.id,
        merchant_group_id: provisionMode === "branch" ? tenantCore.org.group_id || merchantGroupRecord?.id || merchantGroupId || null : null,
        merchant_group_name: provisionMode === "branch" ? merchantGroupRecord?.name || merchantGroupName || null : null,
        branch_name: tenantCore.org.branch_name || branchName || name || orgSlug,
        role,
        plan_id: planId,
        welcome_email: welcomeEmail,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Merchant provisioned but tenant core sync failed",
        details: String(error),
        user_id: result.data.user.id,
        email: result.data.user.email,
        org_slug: orgSlug,
        org_id: orgSlug,
        merchant_group_id: provisionMode === "branch" ? merchantGroupRecord?.id || merchantGroupId || null : null,
        merchant_group_name: provisionMode === "branch" ? merchantGroupRecord?.name || merchantGroupName || null : null,
        branch_name: branchName || name || orgSlug,
        role,
        plan_id: planId,
      },
      { status: 500 }
    );
  }
}
