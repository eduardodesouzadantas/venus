import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, normalizeTenantSlug } from "@/lib/tenant/core";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) {
    return NextResponse.json({ error: "Invalid org slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { org, error: orgError } = await fetchTenantBySlug(supabase, normalizedSlug);
  if (orgError || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("org_id", org.id)
    .order("last_interaction_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && LEAD_STATUSES.includes(status as LeadStatus)) {
    query = query.eq("status", status);
  }

  if (source) {
    query = query.eq("source", source);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data: leads, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    leads: leads || [],
    total: count || 0,
    limit,
    offset,
  });
}