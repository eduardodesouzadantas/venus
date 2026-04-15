import type { OnboardingData } from "@/types/onboarding";
import type { UserJourneySnapshot } from "./profile";
import { buildOnboardingSeedFromSnapshot, normalizeTag } from "./profile";

export type UserJourneyMode = "guest" | "full" | "light" | "continue";

export type UserJourneyState = {
  authenticated: boolean;
  authRequired: boolean;
  mode: UserJourneyMode;
  skipOnboarding: boolean;
  hasGlobalProfile: boolean;
  hasOrgProfile: boolean;
  tags: string[];
  globalTags: string[];
  orgTags: string[];
  lastState: string | null;
  entryRoute: string;
  resumeRoute: string;
  restoreConversation: boolean;
  onboardingSeed: Partial<OnboardingData>;
};

export type UserJourneyResponse = {
  snapshot: UserJourneySnapshot;
  journey: UserJourneyState;
  seed: Partial<OnboardingData>;
};

export type UserJourneyFetchResult = UserJourneyResponse & {
  ok: boolean;
  status: number;
  error: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function orgRoute(orgSlug?: string | null, basePath = "/onboarding/chat") {
  const cleanSlug = normalizeText(orgSlug);
  return cleanSlug ? `${basePath}?org=${encodeURIComponent(cleanSlug)}` : basePath;
}

function routeFromLastState(lastState: string | null, orgSlug?: string | null) {
  const state = normalizeTag(lastState || "");
  switch (state) {
    case "scanner_opt_in":
      return orgRoute(orgSlug, "/scanner/opt-in");
    case "scanner_face":
      return orgRoute(orgSlug, "/scanner/face");
    case "scanner_body":
      return orgRoute(orgSlug, "/scanner/body");
    case "processing":
      return orgRoute(orgSlug, "/scanner/opt-in");
    case "result":
      return orgRoute(orgSlug, "/scanner/opt-in");
    case "onboarding_chat":
    default:
      return orgRoute(orgSlug);
  }
}

function deriveMode(snapshot: UserJourneySnapshot | null, globalTags: string[], orgTags: string[]) {
  const hasOnboarded = [...globalTags, ...orgTags].some((tag) => normalizeTag(tag) === "onboarded");
  if (!snapshot) {
    return hasOnboarded ? "light" : "full";
  }

  if (snapshot.orgProfile) {
    return hasOnboarded ? "continue" : "full";
  }

  return hasOnboarded ? "light" : "full";
}

export function resolveUserJourneyState(
  user: { id?: string | null } | null,
  org: { id?: string | null; slug?: string | null; name?: string | null } | null,
  snapshot: UserJourneySnapshot | null = null
): UserJourneyState {
  const globalTags = (snapshot?.tags || []).filter(Boolean).map((tag) => normalizeTag(tag)).filter(Boolean);
  const orgTags = snapshot?.orgProfile ? ["returning"] : [];
  const lastState = snapshot?.orgProfile?.last_state || null;
  const authenticated = Boolean(user?.id);
  const mode = authenticated ? deriveMode(snapshot, globalTags, orgTags) : "guest";
  const skipOnboarding = authenticated && (mode === "light" || mode === "continue");
  const onboardingSeed = snapshot ? buildOnboardingSeedFromSnapshot(snapshot, org) : {};

  const resumeRoute = authenticated
    ? routeFromLastState(lastState, org?.slug || null)
    : orgRoute(org?.slug || null);

  return {
    authenticated,
    authRequired: !authenticated,
    mode,
    skipOnboarding,
    hasGlobalProfile: Boolean(snapshot?.profile),
    hasOrgProfile: Boolean(snapshot?.orgProfile),
    tags: Array.from(new Set([...globalTags, ...orgTags])),
    globalTags,
    orgTags,
    lastState,
    entryRoute: skipOnboarding ? (mode === "continue" ? resumeRoute : orgRoute(org?.slug || null, "/scanner/opt-in")) : orgRoute(org?.slug || null),
    resumeRoute,
    restoreConversation: Boolean(lastState && lastState !== "onboarding_chat"),
    onboardingSeed,
  };
}

export async function fetchUserJourneyState(orgSlug?: string | null): Promise<UserJourneyFetchResult | null> {
  const query = normalizeText(orgSlug) ? `?org=${encodeURIComponent(normalizeText(orgSlug))}` : "";
  const response = await fetch(`/api/user/journey${query}`, {
    method: "GET",
    headers: {
      "Cache-Control": "no-store",
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status,
      error: typeof payload?.error === "string" ? payload.error : "failed_to_load_user_journey",
      snapshot: { profile: null, orgProfile: null, tags: [] },
      journey: resolveUserJourneyState(null, orgSlug ? { slug: orgSlug } : null, null),
      seed: {},
    };
  }

  return {
    ok: true,
    status: response.status,
    error: null,
    snapshot: payload.snapshot as UserJourneySnapshot,
    journey: payload.journey as UserJourneyState,
    seed: payload.seed as Partial<OnboardingData>,
  };
}

export async function saveUserJourneyState(input: {
  orgSlug?: string | null;
  lastState?: string | null;
  onboardingData?: Partial<OnboardingData> | null;
  source?: string | null;
}) {
  const response = await fetch("/api/user/journey", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status,
      error: typeof payload?.error === "string" ? payload.error : "failed_to_save_user_journey",
      snapshot: { profile: null, orgProfile: null, tags: [] } as UserJourneySnapshot,
      journey: resolveUserJourneyState(null, input.orgSlug ? { slug: input.orgSlug } : null, null),
      seed: {},
    };
  }

  return {
    ok: true,
    status: response.status,
    error: null,
    snapshot: payload.snapshot as UserJourneySnapshot,
    journey: payload.journey as UserJourneyState,
    seed: payload.seed as Partial<OnboardingData>,
  };
}
