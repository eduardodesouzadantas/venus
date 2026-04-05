import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";
import { fetchTenantBySlug, normalizeTenantSlug } from "@/lib/tenant/core";
import { UserContext } from "@/types/whatsapp";

type SavedResultRow = {
  id: string;
  created_at?: string | null;
  org_id?: string | null;
  payload?: Record<string, unknown> | null;
};

type HandoffLook = {
  id?: string;
  name?: string;
  intention?: string;
  type?: string;
  explanation?: string;
  whenToWear?: string;
};

const supabase = createWhatsAppClient();
const CACHE_TTL_MS = 2 * 60 * 1000;

const cachedAtByOrg: Record<string, number> = {};
const cachedPhoneMapByOrg: Record<string, Record<string, UserContext>> = {};

const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "");
const normalizeString = (value?: string | null) => (value || "").trim();
const orgCacheKey = (value?: string | null) => normalizeTenantSlug(value) || "__global__";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const readNestedString = (value: unknown, path: string[]): string | undefined => {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" ? cursor : undefined;
};

const readNestedNumber = (value: unknown, path: string[]): number | undefined => {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "number" ? cursor : undefined;
};

const readNestedArray = (value: unknown, path: string[]): unknown[] => {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return [];
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return Array.isArray(cursor) ? cursor : [];
};

const mapSavedResultToUserContext = (row: SavedResultRow): UserContext | null => {
  const payload = asRecord(row.payload);
  if (!payload) return null;

  const handoff = asRecord(payload.whatsappHandoff);
  const onboardingContext = asRecord(payload.onboardingContext);
  const finalResult = asRecord(payload.finalResult);

  const contactPhone =
    normalizePhone((handoff?.contactPhone as string | undefined) || readNestedString(onboardingContext, ["contact", "phone"]));

  if (!contactPhone) return null;

  const contactName =
    (handoff?.contactName as string | undefined) ||
    readNestedString(onboardingContext, ["contact", "name"]) ||
    "Cliente Venus";

  const styleIdentity =
    (handoff?.styleIdentity as string | undefined) ||
    (handoff?.dominantStyle as string | undefined) ||
    readNestedString(finalResult, ["hero", "dominantStyle"]) ||
    readNestedString(onboardingContext, ["intent", "imageGoal"]) ||
    "Assinatura em evolução";

  const imageGoal =
    (handoff?.imageGoal as string | undefined) ||
    readNestedString(onboardingContext, ["intent", "imageGoal"]) ||
    readNestedString(finalResult, ["diagnostic", "desiredGoal"]) ||
    "";

  const paletteFamily =
    (handoff?.paletteFamily as string | undefined) ||
    readNestedString(finalResult, ["palette", "family"]) ||
    "";

  const fit =
    (handoff?.fit as string | undefined) ||
    readNestedString(onboardingContext, ["body", "fit"]) ||
    "";

  const metal =
    (handoff?.metal as string | undefined) ||
    readNestedString(onboardingContext, ["colors", "metal"]) ||
    readNestedString(finalResult, ["palette", "metal"]) ||
    "";

  const satisfaction = readNestedNumber(onboardingContext, ["intent", "satisfaction"]);
  const intentScore =
    (handoff?.intentScore as number | undefined) ??
    (typeof satisfaction === "number" ? Math.max(0, Math.min(100, satisfaction * 10)) : undefined) ??
    50;

  const handoffLooks = handoff?.lookSummary as HandoffLook[] | undefined;
  const finalResultLooks = readNestedArray(finalResult, ["looks"]);
  const lookSummary = handoffLooks?.length
    ? handoffLooks.map((look) => ({
        id: look.id || "",
        name: look.name || "",
        intention: look.intention || "",
        type: look.type || "",
        explanation: look.explanation || "",
        whenToWear: look.whenToWear || "",
      }))
    : finalResultLooks.map((look) => {
        const item = asRecord(look);
        return {
          id: String(item?.id || ""),
          name: String(item?.name || ""),
          intention: String(item?.intention || ""),
          type: String(item?.type || ""),
          explanation: String(item?.explanation || ""),
          whenToWear: String(item?.whenToWear || ""),
        };
      });

  const viewedProducts = lookSummary.map((look) => look.id).filter(Boolean);
  const lastLookId = lookSummary[0]?.id || "";
  const tryOnCount = lookSummary.length > 0 ? 1 : 0;
  const orgSlug = readNestedString(payload, ["tenant", "orgSlug"]) || undefined;

  return {
    name: contactName,
    phone: contactPhone,
    styleIdentity,
    intentScore,
    viewedProducts,
    lastLookId,
    tryOnCount,
    orgSlug,
    imageGoal,
    paletteFamily,
    fit,
    metal,
    source: "saved_result",
    lastHandoffId: (handoff?.resultId as string | undefined) || row.id,
    lookSummary,
  };
};

async function loadRecentHandoffProfiles(targetOrgSlug?: string) {
  const cacheKey = orgCacheKey(targetOrgSlug);
  const now = Date.now();
  if (now - (cachedAtByOrg[cacheKey] || 0) < CACHE_TTL_MS) {
    return cachedPhoneMapByOrg[cacheKey] || {};
  }

  const resolvedOrg = targetOrgSlug ? await fetchTenantBySlug(supabase, targetOrgSlug) : { org: null, error: null };
  if (targetOrgSlug && !resolvedOrg.org) {
    cachedPhoneMapByOrg[cacheKey] = {};
    cachedAtByOrg[cacheKey] = now;
    return {};
  }
  const targetOrgId = resolvedOrg.org?.id || null;

  let query = supabase
    .from("saved_results")
    .select("id, org_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (targetOrgId) {
    query = query.eq("org_id", targetOrgId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn("[WHATSAPP_CONTEXT_BRIDGE] failed to load saved results", error);
    return cachedPhoneMapByOrg[cacheKey] || {};
  }

  const nextMap: Record<string, UserContext> = {};

  for (const row of data as SavedResultRow[]) {
    if (targetOrgId) {
      const rowOrgId = normalizeString(row.org_id);
      if (!rowOrgId || rowOrgId !== targetOrgId) continue;
    }

    const context = mapSavedResultToUserContext(row);
    if (!context) continue;
    const normalizedPhone = normalizePhone(context.phone);
    if (!normalizedPhone || nextMap[normalizedPhone]) continue;
    nextMap[normalizedPhone] = {
      ...context,
      orgSlug: context.orgSlug || targetOrgSlug || undefined,
    };
  }

  cachedPhoneMapByOrg[cacheKey] = nextMap;
  cachedAtByOrg[cacheKey] = now;
  return cachedPhoneMapByOrg[cacheKey];
}

export async function hydrateWhatsAppConversationContext(conversation: UserContext) {
  if (!conversation?.phone) return conversation;

  const phoneMap = await loadRecentHandoffProfiles(conversation.orgSlug);
  const bridge = phoneMap[normalizePhone(conversation.phone)];
  if (!bridge) return conversation;

  return {
    ...bridge,
    ...conversation,
    name: conversation.name || bridge.name,
    styleIdentity: conversation.styleIdentity || bridge.styleIdentity,
    intentScore: conversation.intentScore || bridge.intentScore,
    viewedProducts: conversation.viewedProducts?.length ? conversation.viewedProducts : bridge.viewedProducts,
    lastLookId: conversation.lastLookId || bridge.lastLookId,
    tryOnCount: conversation.tryOnCount || bridge.tryOnCount,
    orgSlug: conversation.orgSlug || bridge.orgSlug,
    imageGoal: conversation.imageGoal || bridge.imageGoal,
    paletteFamily: conversation.paletteFamily || bridge.paletteFamily,
    fit: conversation.fit || bridge.fit,
    metal: conversation.metal || bridge.metal,
    source: conversation.source || bridge.source,
    lastHandoffId: conversation.lastHandoffId || bridge.lastHandoffId,
    lookSummary: conversation.lookSummary?.length ? conversation.lookSummary : bridge.lookSummary,
  };
}

export async function hydrateWhatsAppConversationList<T extends { user: UserContext; orgSlug?: string }>(conversations: T[]) {
  if (!conversations.length) return conversations;

  const targetOrgSlug = conversations[0]?.user.orgSlug || conversations[0]?.orgSlug;
  const phoneMap = await loadRecentHandoffProfiles(targetOrgSlug);

  return conversations.map((conversation) => {
    const bridge = phoneMap[normalizePhone(conversation.user.phone)];
    if (!bridge) return conversation;

    return {
      ...conversation,
      user: {
        ...bridge,
        ...conversation.user,
        name: conversation.user.name || bridge.name,
        styleIdentity: conversation.user.styleIdentity || bridge.styleIdentity,
        intentScore: conversation.user.intentScore || bridge.intentScore,
        viewedProducts: conversation.user.viewedProducts?.length ? conversation.user.viewedProducts : bridge.viewedProducts,
        lastLookId: conversation.user.lastLookId || bridge.lastLookId,
        tryOnCount: conversation.user.tryOnCount || bridge.tryOnCount,
        orgSlug: conversation.user.orgSlug || bridge.orgSlug,
        imageGoal: conversation.user.imageGoal || bridge.imageGoal,
        paletteFamily: conversation.user.paletteFamily || bridge.paletteFamily,
        fit: conversation.user.fit || bridge.fit,
        metal: conversation.user.metal || bridge.metal,
        source: conversation.user.source || bridge.source,
        lastHandoffId: conversation.user.lastHandoffId || bridge.lastHandoffId,
        lookSummary: conversation.user.lookSummary?.length ? conversation.user.lookSummary : bridge.lookSummary,
      },
    };
  });
}
