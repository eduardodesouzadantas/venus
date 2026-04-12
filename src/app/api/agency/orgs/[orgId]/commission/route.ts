import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAgencyRole, resolveTenantContext } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { orgId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantContext = resolveTenantContext(user);
  if (!tenantContext.role || !isAgencyRole(tenantContext.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { commissionActive?: boolean; commissionRate?: number | string };
  try {
    body = (await req.json()) as { commissionActive?: boolean; commissionRate?: number | string };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const commissionActive = Boolean(body.commissionActive);
  const commissionRateRaw = typeof body.commissionRate === "string" ? Number(body.commissionRate) : body.commissionRate;
  const commissionRate = Number.isFinite(commissionRateRaw as number) ? Number(commissionRateRaw) : 0;
  const normalizedRate = Math.max(3, Math.min(8, commissionRate || 0));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orgs")
    .update({
      commission_active: commissionActive,
      commission_rate: commissionActive ? normalizedRate : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalize(orgId))
    .select("id, slug, name, commission_active, commission_rate")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to update commission settings" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    org: data,
  });
}
