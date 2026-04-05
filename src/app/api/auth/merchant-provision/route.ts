import { NextResponse } from "next/server";
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
    tenant_source: "merchant_provision",
  };

  const userMetadata = {
    email,
    name: name || email.split("@")[0],
    org_slug: orgSlug,
    org_id: orgSlug,
    role,
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
      source: "merchant_provision",
    });

    return NextResponse.json(
      {
        ok: true,
        user_id: result.data.user.id,
        email: result.data.user.email,
        org_slug: orgSlug,
        org_id: orgSlug,
        tenant_org_id: tenantCore.org.id,
        role,
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
      },
      { status: 500 }
    );
  }
}
