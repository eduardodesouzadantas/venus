import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  orgId?: string;
  clientPhone?: string;
  amount?: number | string;
  productId?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const orgId = normalize(body.orgId);
  const clientPhone = normalize(body.clientPhone);
  const productId = normalize(body.productId);
  const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;

  if (!orgId || !clientPhone || !productId || !amount || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Missing orgId, clientPhone, productId or amount" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin.from("orgs").select("id, slug, name, commission_rate, commission_active").eq("id", orgId).maybeSingle();
  if (orgError || !org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const commissionRate = Number(org.commission_rate || 0);
  const commissionActive = Boolean(org.commission_active);
  const rate = commissionActive ? Math.max(0, Math.min(100, commissionRate)) : 0;
  const commissionAmount = Number((amount * (rate / 100)).toFixed(2));

  const { error: insertError } = await admin.from("commission_events").insert({
    org_id: orgId,
    client_phone: clientPhone,
    product_id: productId,
    sale_amount: amount,
    commission_rate: rate,
    commission_amount: commissionAmount,
    confirmed_at: new Date().toISOString(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orgId,
    clientPhone,
    productId,
    saleAmount: amount,
    commissionRate: rate,
    commissionAmount,
  });
}
