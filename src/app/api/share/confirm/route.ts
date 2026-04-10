import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ShareReward {
  type: string;
  value: number | null;
  label: string;
}

interface ShareEventRow {
  id: string;
  confirmed_at: string | null;
  reward_id: string | null;
  share_rewards: ShareReward | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ref_code?: string; platform?: string; org_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { ref_code, platform, org_id } = body;

  if (!ref_code || !org_id) {
    return NextResponse.json({ error: "Missing ref_code or org_id" }, { status: 400 });
  }

  const { data: shareEvent } = await supabase
    .from("share_events")
    .select("id, confirmed_at, reward_id, share_rewards(type, value, label)")
    .eq("ref_code", ref_code)
    .eq("org_id", org_id)
    .maybeSingle<ShareEventRow>();

  if (!shareEvent) {
    return NextResponse.json({ error: "Share event not found" }, { status: 404 });
  }

  if (shareEvent.confirmed_at) {
    return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
  }

  const reward = shareEvent.share_rewards;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const rewardUnlocked = reward
    ? { type: reward.type, value: reward.value, label: reward.label, expires_at: expiresAt }
    : null;

  const { error: updateError } = await supabase
    .from("share_events")
    .update({
      confirmed_at: new Date().toISOString(),
      platform: platform ?? null,
      reward_unlocked: rewardUnlocked,
    })
    .eq("ref_code", ref_code)
    .eq("org_id", org_id);

  if (updateError) {
    console.error("[share/confirm] Update error:", updateError);
    return NextResponse.json({ error: "Failed to confirm share" }, { status: 500 });
  }

  return NextResponse.json({ success: true, reward: rewardUnlocked });
}
