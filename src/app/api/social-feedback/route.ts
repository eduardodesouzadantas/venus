import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SocialFeedbackBody = {
  orgId?: string;
  resultId?: string;
  platform?: string;
  postUrl?: string;
  imageUrl?: string;
  notes?: string;
  aligned?: boolean;
  lookId?: string;
  productId?: string;
};

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(req: NextRequest) {
  let body: SocialFeedbackBody;

  try {
    body = (await req.json()) as SocialFeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const orgId = normalize(body.orgId);
  const resultId = normalize(body.resultId);
  const platform = normalize(body.platform) || "manual";

  if (!orgId || !resultId) {
    return NextResponse.json({ error: "Missing orgId or resultId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: resultRow, error: resultError } = await admin
    .from("saved_results")
    .select("id, org_id, payload")
    .eq("id", resultId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (resultError) {
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  if (!resultRow) {
    return NextResponse.json({ error: "Saved result not found" }, { status: 404 });
  }

  const dedupeSource = [orgId, resultId, platform, body.postUrl || "", body.imageUrl || "", body.notes || ""].join("|");
  const dedupeKey = `social_feedback:${createHash("sha1").update(dedupeSource).digest("hex")}`;

  const { error: insertError } = await admin.from("tenant_events").insert({
    org_id: orgId,
    actor_user_id: null,
    event_type: "customer.social_feedback",
    event_source: "customer",
    dedupe_key: dedupeKey,
    payload: {
      result_id: resultId,
      platform,
      post_url: normalize(body.postUrl) || null,
      image_url: normalize(body.imageUrl) || null,
      notes: normalize(body.notes) || null,
      aligned: Boolean(body.aligned),
      look_id: normalize(body.lookId) || null,
      product_id: normalize(body.productId) || null,
    },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
