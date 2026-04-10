import { NextResponse } from "next/server";
import { sendMerchantWelcomeEmail, type MerchantWelcomeEmailResult } from "@/lib/email/welcome";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTenantCoreRecords, normalizeTenantSlug } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type RequestBody = {
  email?: string;
  password?: string;
  org_slug?: string;
  org_id?: string;
  role?: string;
  name?: string;
  plan_id?: string;
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
  if (normalized === "freemium" || normalized === "starter" || normalized === "pro") {
    return normalized;
  }
  return "";
}

function planLabel(planId: string) {
  switch (planId) {
    case "freemium":
      return "Freemium - 15 dias";
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
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

  if (!email || !password || !orgSlug) {
    return NextResponse.json({ error: "Missing merchant bootstrap data" }, { status: 400 });
  }

  if (!isMerchantRole(role)) {
    return NextResponse.json({ error: "Unsupported role" }, { status: 403 });
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
  const metadata = {
    org_slug: orgSlug,
    org_id: orgSlug,
    role,
    plan_id: planId,
    tenant_source: "merchant_provision",
  };

  const userMetadata = {
    email,
    name: name || email.split("@")[0],
    org_slug: orgSlug,
    org_id: orgSlug,
    role,
    plan_id: planId,
  };

  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, {
        password,
        app_metadata: metadata,
        user_metadata: userMetadata,
        email_confirm: true,
      })
    : await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: metadata,
        user_metadata: userMetadata,
      });

  if (result.error || !result.data.user) {
    return NextResponse.json({ error: result.error?.message || "Could not provision merchant" }, { status: 500 });
  }

  try {
    const tenantCore = await ensureTenantCoreRecords(admin, {
      orgSlug,
      orgName: name || result.data.user.email || orgSlug,
      ownerUserId: result.data.user.id,
      role,
      planId,
      source: "merchant_provision",
    });

    const loginUrl = new URL("/b2b/login", request.url).toString();
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
        org_id: orgSlug,
        tenant_org_id: tenantCore.org.id,
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
        role,
        plan_id: planId,
      },
      { status: 500 }
    );
  }
}
