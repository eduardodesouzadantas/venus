import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import {
  normalizeRewardExpiresAt,
  normalizeRewardType,
  normalizeRewardValue,
  rewardTypeNeedsValue,
} from "@/lib/merchant/rewards";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type RewardBody = {
  reward_id?: string;
  type?: string;
  value?: string | number | null;
  label?: string;
  active?: boolean;
  expires_at?: string | null;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveRewardOrg(slug: string) {
  return resolveMerchantOrgAccess(slug);
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const access = await resolveRewardOrg(slug);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("share_rewards")
      .select("id, org_id, type, value, label, active, expires_at, created_at")
      .eq("org_id", access.org.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        org: {
          id: access.org.id,
          slug: access.org.slug,
          name: access.org.name,
        },
        rewards: data || [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load rewards" },
      { status: 403 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await resolveRewardOrg(slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 403 }
    );
  }

  let body: RewardBody = {};
  try {
    body = (await request.json()) as RewardBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const type = normalizeRewardType(body.type);
  const label = normalize(body.label);

  if (!type || !label) {
    return NextResponse.json({ error: "Missing reward type or label" }, { status: 400 });
  }

  const value = normalizeRewardValue(type, body.value);
  if (rewardTypeNeedsValue(type) && value === null) {
    return NextResponse.json({ error: "Reward value is required for this type" }, { status: 400 });
  }

  const expiresAt = normalizeRewardExpiresAt(body.expires_at);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("share_rewards")
    .insert({
      org_id: access.org.id,
      type,
      value,
      label,
      active: body.active ?? true,
      expires_at: expiresAt,
    })
    .select("id, org_id, type, value, label, active, expires_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create reward" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, reward: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await resolveRewardOrg(slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 403 }
    );
  }

  let body: RewardBody = {};
  try {
    body = (await request.json()) as RewardBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rewardId = normalize(body.reward_id);
  if (!rewardId) {
    return NextResponse.json({ error: "Missing reward_id" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof body.active === "boolean") {
    updatePayload.active = body.active;
  }

  if (body.label !== undefined) {
    const label = normalize(body.label);
    if (label) updatePayload.label = label;
  }

  if (body.type !== undefined) {
    const type = normalizeRewardType(body.type);
    if (!type) {
      return NextResponse.json({ error: "Invalid reward type" }, { status: 400 });
    }
    updatePayload.type = type;
    if (rewardTypeNeedsValue(type)) {
      const value = normalizeRewardValue(type, body.value);
      if (value === null) {
        return NextResponse.json({ error: "Reward value is required for this type" }, { status: 400 });
      }
      updatePayload.value = value;
    } else {
      updatePayload.value = null;
    }
  } else if (body.value !== undefined) {
    const currentType = normalizeRewardType(body.type) || null;
    if (currentType && rewardTypeNeedsValue(currentType)) {
      const value = normalizeRewardValue(currentType, body.value);
      if (value === null) {
        return NextResponse.json({ error: "Reward value is required for this type" }, { status: 400 });
      }
      updatePayload.value = value;
    }
  }

  if (body.expires_at !== undefined) {
    updatePayload.expires_at = normalizeRewardExpiresAt(body.expires_at);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("share_rewards")
    .update({
      ...updatePayload,
    })
    .eq("id", rewardId)
    .eq("org_id", access.org.id)
    .select("id, org_id, type, value, label, active, expires_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to update reward" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, reward: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await resolveRewardOrg(slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 403 }
    );
  }

  let body: RewardBody = {};
  try {
    body = (await request.json()) as RewardBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rewardId = normalize(body.reward_id);
  if (!rewardId) {
    return NextResponse.json({ error: "Missing reward_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("share_rewards").delete().eq("id", rewardId).eq("org_id", access.org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
