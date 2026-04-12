import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SaleConfirmBody = {
  orgId?: string;
  clientPhone?: string;
  amount?: number;
  productId?: string;
};

export async function POST(req: NextRequest) {
  let body: SaleConfirmBody;
  try {
    body = (await req.json()) as SaleConfirmBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { orgId, clientPhone, amount, productId } = body;
  if (!orgId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Missing orgId or amount" }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("orgs")
    .select("commission_rate, commission_active")
    .eq("id", orgId)
    .maybeSingle();

  type OrgRow = { commission_rate: number | null; commission_active: boolean | null };
  const orgRow = org as OrgRow | null;

  if (!orgRow?.commission_active || !orgRow?.commission_rate) {
    return NextResponse.json({ success: true, commission: 0 });
  }

  const commissionAmount = amount * (orgRow.commission_rate / 100);

  await supabase.from("commission_events").insert({
    org_id: orgId,
    client_phone: clientPhone ?? null,
    product_id: productId ?? null,
    sale_amount: amount,
    commission_rate: orgRow.commission_rate,
    commission_amount: commissionAmount,
  });

  return NextResponse.json({ success: true, commission: commissionAmount });
}
