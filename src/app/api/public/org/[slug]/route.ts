import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTenantSlug } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const normalizedSlug = normalizeTenantSlug(slug);

  if (!normalizedSlug) {
    return NextResponse.json({ error: "Missing org slug" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orgs")
    .select("id, slug, name, branch_name, logo_url, primary_color")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      org: {
        id: data.id,
        slug: data.slug,
        name: data.name || null,
        branch_name: data.branch_name || null,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color || null,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
