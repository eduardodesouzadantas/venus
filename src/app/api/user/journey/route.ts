import { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { fetchOrgIdFromSlug, type TenantRecord } from "@/lib/tenant/core";
import type { OnboardingData } from "@/types/onboarding";
import {
  buildOnboardingSeedFromSnapshot,
  buildUserOrgProfileUpsert,
  buildUserProfileUpsert,
  buildUserTagRows,
  deriveUserTags,
  normalizeTag,
  type UserJourneySnapshot,
  type UserOrgProfileRecord,
  type UserProfileRecord,
} from "@/lib/user/profile";
import { resolveUserJourneyState } from "@/lib/user/journey";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JourneyBody = {
  orgSlug?: string | null;
  orgId?: string | null;
  lastState?: string | null;
  source?: string | null;
  onboardingData?: Record<string, unknown> | null;
};

function json(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, { status });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [];
}

async function resolveOrg(admin: ReturnType<typeof createAdminClient>, input: JourneyBody) {
  const orgId = normalizeText(input.orgId);
  const orgSlug = normalizeText(input.orgSlug);

  if (orgId) {
    const { data } = await admin.from("orgs").select("id, slug, name").eq("id", orgId).maybeSingle();
    if (data) {
      return data as Pick<TenantRecord, "id" | "slug" | "name">;
    }
  }

  if (orgSlug) {
    const resolvedOrgId = await fetchOrgIdFromSlug(admin, orgSlug);
    if (resolvedOrgId) {
      const { data } = await admin.from("orgs").select("id, slug, name").eq("id", resolvedOrgId).maybeSingle();
      if (data) {
        return data as Pick<TenantRecord, "id" | "slug" | "name">;
      }
    }
  }

  return null;
}

async function loadSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  orgId?: string | null
): Promise<UserJourneySnapshot> {
  const [profileResult, orgProfileResult, globalTagsResult, orgTagsResult] = await Promise.all([
    admin.from("user_profiles").select("*").eq("id", userId).maybeSingle(),
    orgId
      ? admin.from("user_org_profiles").select("*").eq("user_id", userId).eq("org_id", orgId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from("user_tags").select("tag").eq("user_id", userId).eq("scope", "global"),
    orgId
      ? admin.from("user_tags").select("tag").eq("user_id", userId).eq("org_id", orgId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profile = profileResult.data ? (profileResult.data as UserProfileRecord) : null;
  const orgProfile = orgProfileResult.data ? (orgProfileResult.data as UserOrgProfileRecord) : null;
  const globalTags = asStringArray(globalTagsResult.data?.map((row) => row.tag));
  const orgTags = asStringArray((orgTagsResult as { data?: Array<{ tag?: string }> }).data?.map((row) => row.tag));

  return {
    profile,
    orgProfile,
    tags: Array.from(new Set([...globalTags, ...orgTags])),
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const org = await resolveOrg(admin, {
    orgId: request.nextUrl.searchParams.get("org_id"),
    orgSlug: request.nextUrl.searchParams.get("org"),
  });

  if (!user) {
    const snapshot: UserJourneySnapshot = { profile: null, orgProfile: null, tags: [] };
    const journey = resolveUserJourneyState(null, org, snapshot);
    return json({
      snapshot,
      journey,
      seed: buildOnboardingSeedFromSnapshot(snapshot, org),
    });
  }

  const snapshot = await loadSnapshot(admin, user.id, org?.id || null);
  const journey = resolveUserJourneyState(user, org, snapshot);

  return json({
    snapshot,
    journey,
    seed: buildOnboardingSeedFromSnapshot(snapshot, org),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "authentication_required" }, 401);
  }

  const rawBody = (await request.json().catch(() => null)) as JourneyBody | null;
  if (!rawBody) {
    return json({ error: "invalid_payload" }, 400);
  }

  const admin = createAdminClient();
  const org = await resolveOrg(admin, rawBody);
  const onboardingData = (rawBody.onboardingData || {}) as Partial<OnboardingData>;
  const profileRow = buildUserProfileUpsert(user.id, onboardingData);
  const now = new Date().toISOString();

  await admin.from("user_profiles").upsert(
    {
      ...profileRow,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  let existingOrgProfile: Pick<UserOrgProfileRecord, "purchase_history" | "interactions" | "last_state" | "engagement_score"> | null = null;
  if (org?.id) {
    const { data } = await admin
      .from("user_org_profiles")
      .select("purchase_history, interactions, last_state, engagement_score")
      .eq("user_id", user.id)
      .eq("org_id", org.id)
      .maybeSingle();
    existingOrgProfile = data ? (data as Pick<UserOrgProfileRecord, "purchase_history" | "interactions" | "last_state" | "engagement_score">) : null;
  }

  let orgProfile: UserOrgProfileRecord | null = null;
  if (org?.id) {
    const orgProfileRow = buildUserOrgProfileUpsert({
      userId: user.id,
      orgId: org.id,
      orgSlug: org.slug,
      onboardingData,
      lastState: rawBody.lastState || null,
      existingOrgProfile,
    });

    const { data } = await admin.from("user_org_profiles").upsert(
      {
        org_id: org.id,
        user_id: user.id,
        purchase_history: orgProfileRow.purchase_history,
        interactions: orgProfileRow.interactions,
        last_state: orgProfileRow.last_state,
        engagement_score: orgProfileRow.engagement_score,
        updated_at: now,
      },
      { onConflict: "org_id,user_id" }
    ).select("*").maybeSingle();

    orgProfile = data || null;
  }

  const existingGlobalTagsResult = await admin.from("user_tags").select("tag").eq("user_id", user.id).eq("scope", "global");
  const existingOrgTagsResult = org?.id
    ? await admin.from("user_tags").select("tag").eq("user_id", user.id).eq("org_id", org.id)
    : { data: [] as Array<{ tag: string }>, error: null };
  const existingTags = [
    ...(existingGlobalTagsResult.data || []).map((row) => row.tag),
    ...(existingOrgTagsResult.data || []).map((row) => row.tag),
  ];

  const derivedTags = deriveUserTags({
    existingTags,
    onboardingData,
    orgProfile: orgProfile
      ? {
          purchase_history: orgProfile.purchase_history,
          engagement_score: orgProfile.engagement_score,
          last_state: orgProfile.last_state,
        }
      : existingOrgProfile,
  });

  const globalTags = derivedTags.filter((tag) => normalizeTag(tag) === "onboarded");
  const orgTags = derivedTags.filter((tag) => normalizeTag(tag) !== "onboarded");

  const tagRows = [
    ...buildUserTagRows({ userId: user.id, tags: globalTags, source: rawBody.source || "journey" }),
    ...(org?.id
      ? buildUserTagRows({
          userId: user.id,
          orgId: org.id,
          tags: orgTags,
          source: rawBody.source || "journey",
        })
      : []),
  ];

  if (tagRows.length > 0) {
    await admin.from("user_tags").upsert(tagRows, { onConflict: "tag_key" });
  }

  const snapshot = await loadSnapshot(admin, user.id, org?.id || null);
  const journey = resolveUserJourneyState(user, org, snapshot);

  return json({
    snapshot,
    journey,
    seed: buildOnboardingSeedFromSnapshot(snapshot, org),
  });
}
