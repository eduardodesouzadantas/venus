import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RequestBody = {
  email?: string;
  password?: string;
  role?: string;
  name?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAgencyRole(role: string) {
  return role.startsWith("agency_");
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
  const role = normalize(body.role) || "agency_owner";
  const name = normalize(body.name);

  if (!email || !password) {
    return NextResponse.json({ error: "Missing agency bootstrap data" }, { status: 400 });
  }

  if (!isAgencyRole(role)) {
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
    role,
    tenant_source: "agency_provision",
  };

  const userMetadata = {
    email,
    name: name || email.split("@")[0],
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
    return NextResponse.json({ error: result.error?.message || "Could not provision agency auth" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      user_id: result.data.user.id,
      email: result.data.user.email,
      role,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
