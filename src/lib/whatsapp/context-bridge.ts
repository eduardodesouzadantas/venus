import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";
import { fetchTenantBySlug, normalizeTenantSlug } from "@/lib/tenant/core";
import type { UserContext, WhatsAppLookItemContext, WhatsAppLookSummary } from "@/types/whatsapp";

type SavedResultRow = {
  id: string;
  created_at?: string | null;
  org_id?: string | null;
  payload?: Record<string, unknown> | null;
};

type LeadRow = {
  id: string;
  org_id?: string | null;
  name?: string | null;
  phone?: string | null;
  whatsapp_key?: string | null;
  saved_result_id?: string | null;
};

type LeadContextRow = {
  user_id: string;
  org_id: string;
  profile_data?: Record<string, unknown> | null;
  style_profile?: Record<string, unknown> | null;
  colorimetry?: Record<string, unknown> | null;
  body_analysis?: Record<string, unknown> | null;
  intent_score?: number | null;
  emotional_state?: Record<string, unknown> | null;
  last_tryon?: Record<string, unknown> | null;
  last_products_viewed?: unknown[] | null;
  last_recommendations?: unknown[] | null;
  whatsapp_context?: Record<string, unknown> | null;
  updated_at?: string | null;
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

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeString(typeof entry === "string" ? entry : "")).filter(Boolean);
};

const extractViewedProducts = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return normalizeString(entry);
      if (!entry || typeof entry !== "object") return "";
      const record = entry as Record<string, unknown>;
      return normalizeString((record.id as string | undefined) || (record.name as string | undefined));
    })
    .filter(Boolean);
};

const extractLookSummary = (value: unknown): WhatsAppLookSummary[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => mapLookSummary(entry))
    .filter((entry): entry is WhatsAppLookSummary => Boolean(entry));
};

const mapLeadContextToUserContext = (lead: LeadRow, context: LeadContextRow, orgSlug?: string | null): UserContext | null => {
  const profile = asRecord(context.profile_data);
  const styleProfile = asRecord(context.style_profile);
  const colorimetry = asRecord(context.colorimetry);
  const bodyAnalysis = asRecord(context.body_analysis);
  const emotionalState = asRecord(context.emotional_state);
  const whatsapp = asRecord(context.whatsapp_context);

  const phone =
    normalizePhone(lead.phone || lead.whatsapp_key || (profile?.phone as string | undefined) || (whatsapp?.contactPhone as string | undefined));

  if (!phone) {
    return null;
  }

  const name =
    normalizeString((profile?.name as string | undefined) || (whatsapp?.contactName as string | undefined) || lead.name || "Cliente Venus");

  const styleIdentity =
    normalizeString((styleProfile?.styleIdentity as string | undefined) || (styleProfile?.dominantStyle as string | undefined) || (whatsapp?.styleIdentity as string | undefined));

  const imageGoal = normalizeString((styleProfile?.imageGoal as string | undefined) || (whatsapp?.imageGoal as string | undefined));
  const paletteFamily =
    normalizeString((styleProfile?.paletteFamily as string | undefined) || (colorimetry?.colorSeason as string | undefined) || (whatsapp?.paletteFamily as string | undefined));
  const fit = normalizeString((bodyAnalysis?.fit as string | undefined) || (styleProfile?.fit as string | undefined) || (whatsapp?.fit as string | undefined));
  const metal = normalizeString((colorimetry?.metal as string | undefined) || (styleProfile?.metal as string | undefined) || (whatsapp?.metal as string | undefined));

  return {
    name,
    phone,
    styleIdentity,
    intentScore: typeof context.intent_score === "number" ? context.intent_score : Number(emotionalState?.intentScore || whatsapp?.intentScore || 0) || 0,
    lastTryOn: context.last_tryon as any,
    viewedProducts: extractViewedProducts(context.last_products_viewed),
    lastLookId: normalizeString((context.last_tryon?.lookId as string | undefined) || (whatsapp?.lastLookId as string | undefined)),
    tryOnCount: context.last_tryon ? 1 : 0,
    orgSlug: orgSlug || normalizeString((whatsapp?.orgSlug as string | undefined)) || undefined,
    styleDirection: normalizeString((styleProfile?.styleDirection as string | undefined) || (whatsapp?.styleDirection as string | undefined)),
    imageGoal,
    paletteFamily,
    fit,
    metal,
    source: "automation",
    lastHandoffId: normalizeString((whatsapp?.resultId as string | undefined) || (lead.saved_result_id as string | undefined)),
    lookSummary: extractLookSummary(context.last_recommendations),
  };
};

const mapLookItem = (value: unknown): WhatsAppLookItemContext | null => {
  const item = asRecord(value);
  if (!item) return null;

  const name = normalizeString((item.name as string | undefined) || (item.premiumTitle as string | undefined));
  const id = normalizeString(item.id as string | undefined);

  if (!id && !name) return null;

  return {
    id: id || name,
    name: name || id || "Item",
    brand: normalizeString(item.brand as string | undefined) || undefined,
    price: normalizeString(item.price as string | undefined) || undefined,
    role: normalizeString(item.role as string | undefined) || undefined,
    direction: normalizeString(item.direction as string | undefined) || undefined,
    visualWeight: normalizeString(item.visualWeight as string | undefined) || undefined,
    formality: normalizeString(item.formality as string | undefined) || undefined,
    bodyEffect: normalizeString(item.bodyEffect as string | undefined) || undefined,
    faceEffect: normalizeString(item.faceEffect as string | undefined) || undefined,
    premiumTitle: normalizeString(item.premiumTitle as string | undefined) || undefined,
    baseDescription: normalizeString(item.baseDescription as string | undefined) || undefined,
    persuasiveDescription: normalizeString(item.persuasiveDescription as string | undefined) || undefined,
    impactLine: normalizeString(item.impactLine as string | undefined) || undefined,
    functionalBenefit: normalizeString(item.functionalBenefit as string | undefined) || undefined,
    socialEffect: normalizeString(item.socialEffect as string | undefined) || undefined,
    contextOfUse: normalizeString(item.contextOfUse as string | undefined) || undefined,
    styleTags: normalizeStringArray(item.styleTags),
    categoryTags: normalizeStringArray(item.categoryTags),
    fitTags: normalizeStringArray(item.fitTags),
    colorTags: normalizeStringArray(item.colorTags),
    targetProfile: normalizeStringArray(item.targetProfile),
    useCases: normalizeStringArray(item.useCases),
    category: normalizeString(item.category as string | undefined) || undefined,
    useCase: normalizeString(item.useCase as string | undefined) || undefined,
    tryOnUrl: normalizeString(item.tryOnUrl as string | undefined) || undefined,
    bundleCandidates: normalizeStringArray(item.bundleCandidates),
    authorityRationale: normalizeString(item.authorityRationale as string | undefined) || undefined,
    conversionCopy: normalizeString(item.conversionCopy as string | undefined) || undefined,
    sellerSuggestions: item.sellerSuggestions && typeof item.sellerSuggestions === "object" && !Array.isArray(item.sellerSuggestions)
      ? {
        pairsBestWith: normalizeStringArray((item.sellerSuggestions as Record<string, unknown>).pairsBestWith),
        idealFor: normalizeString((item.sellerSuggestions as Record<string, unknown>).idealFor as string | undefined),
        buyerProfiles: normalizeStringArray((item.sellerSuggestions as Record<string, unknown>).buyerProfiles),
        bestContext: normalizeString((item.sellerSuggestions as Record<string, unknown>).bestContext as string | undefined),
      }
      : undefined,
  };
};

const mapLookSummary = (value: unknown): WhatsAppLookSummary | null => {
  const look = asRecord(value);
  if (!look) return null;

  const items = readNestedArray(look, ["items"])
    .map(mapLookItem)
    .filter((entry): entry is WhatsAppLookItemContext => Boolean(entry));

  return {
    id: normalizeString(look.id as string | undefined),
    name: normalizeString(look.name as string | undefined),
    intention: normalizeString(look.intention as string | undefined),
    type: normalizeString(look.type as string | undefined),
    explanation: normalizeString(look.explanation as string | undefined),
    whenToWear: normalizeString(look.whenToWear as string | undefined),
    role: normalizeString(look.role as string | undefined) || undefined,
    direction: normalizeString(look.direction as string | undefined) || undefined,
    visualWeight: normalizeString(look.visualWeight as string | undefined) || undefined,
    formality: normalizeString(look.formality as string | undefined) || undefined,
    bodyEffect: normalizeString(look.bodyEffect as string | undefined) || undefined,
    faceEffect: normalizeString(look.faceEffect as string | undefined) || undefined,
    styleTags: normalizeStringArray(look.styleTags),
    categoryTags: normalizeStringArray(look.categoryTags),
    fitTags: normalizeStringArray(look.fitTags),
    colorTags: normalizeStringArray(look.colorTags),
    targetProfile: normalizeStringArray(look.targetProfile),
    useCases: normalizeStringArray(look.useCases),
    category: normalizeString(look.category as string | undefined) || undefined,
    useCase: normalizeString(look.useCase as string | undefined) || undefined,
    authorityRationale: normalizeString(look.authorityRationale as string | undefined) || undefined,
    conversionCopy: normalizeString(look.conversionCopy as string | undefined) || undefined,
    sellerSuggestions: look.sellerSuggestions && typeof look.sellerSuggestions === "object" && !Array.isArray(look.sellerSuggestions)
      ? {
        pairsBestWith: normalizeStringArray((look.sellerSuggestions as Record<string, unknown>).pairsBestWith),
        idealFor: normalizeString((look.sellerSuggestions as Record<string, unknown>).idealFor as string | undefined),
        buyerProfiles: normalizeStringArray((look.sellerSuggestions as Record<string, unknown>).buyerProfiles),
        bestContext: normalizeString((look.sellerSuggestions as Record<string, unknown>).bestContext as string | undefined),
      }
      : undefined,
    items,
  };
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

  const styleDirection =
    (handoff?.styleDirection as string | undefined) ||
    readNestedString(onboardingContext, ["intent", "styleDirection"]) ||
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

  const handoffLooks = handoff?.lookSummary as unknown[] | undefined;
  const finalResultLooks = readNestedArray(finalResult, ["looks"]);
  const lookSummary = handoffLooks?.length
    ? handoffLooks.map(mapLookSummary).filter((entry): entry is WhatsAppLookSummary => Boolean(entry))
    : finalResultLooks.map(mapLookSummary).filter((entry): entry is WhatsAppLookSummary => Boolean(entry));

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
    styleDirection,
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

  const [leadsResult, contextsResult, savedResultsResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id, org_id, name, phone, whatsapp_key, saved_result_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("lead_context")
      .select("user_id, org_id, profile_data, style_profile, colorimetry, body_analysis, intent_score, emotional_state, last_tryon, last_products_viewed, last_recommendations, whatsapp_context, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("saved_results")
      .select("id, org_id, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (leadsResult.error || contextsResult.error || savedResultsResult.error) {
    console.warn("[WHATSAPP_CONTEXT_BRIDGE] failed to load lead context", leadsResult.error || contextsResult.error || savedResultsResult.error);
    return cachedPhoneMapByOrg[cacheKey] || {};
  }

  const leadRows = ((leadsResult.data || []) as LeadRow[]).filter((row) => {
    if (!targetOrgId) return true;
    return normalizeString(row.org_id) === targetOrgId;
  });
  const leadById = new Map(leadRows.map((row) => [row.id, row]));
  const contextRows = ((contextsResult.data || []) as LeadContextRow[]).filter((row) => {
    if (!targetOrgId) return true;
    return normalizeString(row.org_id) === targetOrgId;
  });

  const nextMap: Record<string, UserContext> = {};

  for (const row of contextRows) {
    const lead = leadById.get(row.user_id);
    if (!lead) continue;
    const context = mapLeadContextToUserContext(lead, row, targetOrgSlug || undefined);
    if (!context) continue;
    const normalizedPhone = normalizePhone(context.phone);
    if (!normalizedPhone || nextMap[normalizedPhone]) continue;
    nextMap[normalizedPhone] = context;
  }

  if (!Object.keys(nextMap).length) {
    const savedResults = savedResultsResult.data || [];
    for (const row of savedResults as SavedResultRow[]) {
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
    styleDirection: conversation.styleDirection || bridge.styleDirection,
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
        styleDirection: conversation.user.styleDirection || bridge.styleDirection,
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
