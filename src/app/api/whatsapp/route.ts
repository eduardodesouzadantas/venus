import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type WhatsAppAuthUser = Pick<User, "id" | "email" | "app_metadata" | "user_metadata">;

function readTenantFromMetadata(user: WhatsAppAuthUser | null | undefined) {
  const appMetadata = (user?.app_metadata as Record<string, unknown> | null | undefined) || {};
  const userMetadata = (user?.user_metadata as Record<string, unknown> | null | undefined) || {};

  return normalize(
    appMetadata.org_slug ||
      appMetadata.org_id ||
      userMetadata.org_slug ||
      userMetadata.org_id
  );
}

function buildTokenResponse(session: {
  access_token: string;
  expires_in?: number;
  expires_at?: number;
}, user: WhatsAppAuthUser, orgSlug: string) {
  return NextResponse.json(
    {
      access_token: session.access_token,
      token_type: "bearer",
      expires_in: session.expires_in || 3600,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + 3600,
      org_slug: orgSlug,
      org_id: orgSlug,
      email: user?.email || "",
      user_id: user?.id || "",
      source: "supabase",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Missing Supabase auth session" }, { status: 401 });
  }

  const authOrg = readTenantFromMetadata(user);

  if (authOrg) {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session?.access_token) {
      return NextResponse.json({ error: "Missing Supabase session token" }, { status: 401 });
    }

    return buildTokenResponse(session, user, authOrg);
  }

  return NextResponse.json(
    {
      error: "Missing tenant metadata",
      needs_tenant_sync: true,
    },
    { status: 409 }
  );
}
