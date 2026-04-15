import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductStockSnapshot } from "@/lib/catalog/stock";
import { decryptStoredMetaIntegrationToken, loadMetaIntegrationByOrgId, sendMetaWhatsAppTextMessage } from "@/lib/whatsapp/meta";
import { generateReply } from "@/lib/venus/VenusStylist";
import { loadContext } from "@/lib/venus/ConversationContext";
import { generateWACopy } from "@/lib/whatsapp/copy";
import type { VenusContext, VenusIntent } from "@/lib/venus/types";

export const dynamic = "force-dynamic";

type CampaignType = "new_collection" | "reengagement" | "tryon_followup" | "anniversary" | "dead_stock";

type CampaignBody = {
  orgId?: string;
  campaignType?: CampaignType | string;
  payload?: Record<string, unknown>;
};

type LeadRow = {
  id: string;
  org_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  saved_result_id: string | null;
  intent_score: number | null;
  whatsapp_key: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_interaction_at: string | null;
};

type SavedResultRow = {
  id: string;
  payload: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  primary_color: string | null;
  style: string | null;
  image_url: string | null;
  stock_qty: number | null;
  reserved_qty: number | null;
  stock_status: string | null;
  stock: number | null;
  style_direction?: string | null;
  color_tags?: string[] | null;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLower(value: unknown) {
  return normalize(value).toLowerCase();
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalize(typeof entry === "string" ? entry : "")).filter(Boolean);
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(value: unknown): string[] {
  const text = stripDiacritics(normalizeLower(value));
  if (!text) return [];
  return text
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readNestedString(value: unknown, path: string[]) {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return "";
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return normalize(cursor);
}

function readFavoriteColors(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const onboarding = asRecord(payload.onboardingContext);
  const colors = asRecord(onboarding?.colors) || asRecord(payload.colors);
  const colorimetry = asRecord(onboarding?.colorimetry) || asRecord(payload.colorimetry);
  return [
    ...normalizeArray(colorimetry?.favoriteColors),
    ...normalizeArray(colors?.favoriteColors),
    ...normalizeArray(readNestedString(payload, ["onboardingContext", "colors", "favoriteColors"]).split(",")),
  ].filter(Boolean);
}

function readAvoidColors(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const onboarding = asRecord(payload.onboardingContext);
  const colors = asRecord(onboarding?.colors) || asRecord(payload.colors);
  const colorimetry = asRecord(onboarding?.colorimetry) || asRecord(payload.colorimetry);
  return [...normalizeArray(colorimetry?.avoidColors), ...normalizeArray(colors?.avoidColors)].filter(Boolean);
}

function getProductTokens(product: ProductRow, payload: Record<string, unknown>) {
  const payloadTokens = [
    ...tokenize(product.name),
    ...tokenize(product.category),
    ...tokenize(product.primary_color),
    ...tokenize(product.style),
    ...tokenize(product.style_direction),
    ...normalizeArray(product.color_tags),
    ...tokenize(payload.productName),
    ...tokenize(payload.productCategory),
    ...tokenize(payload.productColor),
    ...tokenize(payload.lookName),
  ];

  return Array.from(new Set(payloadTokens));
}

function paletteMatchScore(favorites: string[], avoid: string[], productTokens: string[]) {
  const favoriteTokens = favorites.flatMap((value) => tokenize(value));
  const avoidTokens = avoid.flatMap((value) => tokenize(value));
  const matches = favoriteTokens.filter((token) => productTokens.some((productToken) => productToken.includes(token) || token.includes(productToken)));
  const conflicts = avoidTokens.filter((token) => productTokens.some((productToken) => productToken.includes(token) || token.includes(productToken)));
  return { matches: matches.length, conflicts: conflicts.length };
}

function tokenOverlapScore(values: string[], productTokens: string[]) {
  const tokens = values.flatMap((value) => tokenize(value));
  return tokens.filter((token) => productTokens.some((productToken) => productToken.includes(token) || token.includes(productToken))).length;
}

async function buildReplyForLead(
  orgId: string,
  lead: LeadRow,
  payload: Record<string, unknown>,
  campaignType: CampaignType,
  product?: ProductRow | null
) {
  const phone = normalize(lead.phone || lead.whatsapp_key);
  if (!phone) return "";

  const context = await loadContext(phone, orgId).catch(() => null);
  if (!context) return "";

  const triggerText =
    campaignType === "new_collection"
      ? `Nova coleção disponível: ${normalize(payload.productName) || product?.name || "uma nova peça"}`
      : campaignType === "reengagement"
        ? "Quero reengajar esse cliente com elegância e sem pressão."
        : campaignType === "tryon_followup"
          ? "Esse cliente fez try-on recentemente. Faça um follow-up consultivo e curto."
          : campaignType === "anniversary"
            ? "Hoje é aniversário do cliente. Crie uma mensagem calorosa e especial."
            : "Temos um produto com estoque parado. Crie uma abordagem segmentada e elegante.";

  const state: VenusIntent =
    campaignType === "reengagement"
      ? "sumiu"
      : campaignType === "tryon_followup"
        ? "interesse"
        : campaignType === "anniversary"
          ? "primeira_mensagem"
          : "curiosidade";

  const enhancedContext: VenusContext = {
    ...context,
    state,
    productName: normalize(payload.productName) || product?.name || context.productName,
    productCategory: normalize(payload.productCategory) || product?.category || context.productCategory,
    productStyle: normalize(payload.productStyle) || product?.style || context.productStyle,
    productColor: normalize(payload.productColor) || product?.primary_color || context.productColor,
    look: normalize(payload.lookName) || context.look,
    stockSummary: product ? `Estoque atual: ${resolveProductStockSnapshot(product).availableQty}` : context.stockSummary,
  };

  const reply = await generateReply(enhancedContext, triggerText).catch(() => "");
  if (reply) {
    return reply.trim();
  }

  const tone = campaignType === "anniversary" ? "elegant" : campaignType === "dead_stock" ? "concise" : "premium";
  const objective =
    campaignType === "new_collection"
      ? "novidades"
      : campaignType === "reengagement"
        ? "recuperar_inativo"
        : campaignType === "tryon_followup"
          ? "pos_compra"
          : campaignType === "anniversary"
            ? "recompra"
            : "cross_sell";

  const fallback = generateWACopy(objective as never, campaignType === "tryon_followup" ? "alta_intencao" : "inativos", tone as never);
  return `${fallback.headline}: ${fallback.body} ${fallback.cta}`.trim();
}

async function loadEligibleData(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const [leadsResult, savedResultsResult, productsResult] = await Promise.all([
    admin
      .from("leads")
      .select("id, org_id, name, email, phone, status, saved_result_id, intent_score, whatsapp_key, next_follow_up_at, created_at, updated_at, last_interaction_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(200),
    admin
      .from("saved_results")
      .select("id, payload")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("products")
      .select("id, name, category, primary_color, style, image_url, stock_qty, reserved_qty, stock_status, stock, style_direction, color_tags")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (leadsResult.error) throw leadsResult.error;
  if (savedResultsResult.error) throw savedResultsResult.error;
  if (productsResult.error) throw productsResult.error;

  return {
    leads: (leadsResult.data || []) as LeadRow[],
    savedResults: (savedResultsResult.data || []) as SavedResultRow[],
    products: (productsResult.data || []) as ProductRow[],
  };
}

function leadSignalsFromPayload(payload: Record<string, unknown> | null) {
  const onboarding = asRecord(payload?.onboardingContext);
  const contact = asRecord(onboarding?.contact);
  const finalResult = asRecord(payload?.finalResult);
  return {
    name: normalize(readNestedString(onboarding, ["contact", "name"])) || normalize(contact?.name),
    favoriteColors: readFavoriteColors(payload),
    avoidColors: readAvoidColors(payload),
    styleIdentity: normalize(readNestedString(onboarding, ["intent", "styleDirection"])) || normalize(readNestedString(finalResult, ["essence", "label"])),
    styleDirection: normalize(readNestedString(onboarding, ["intent", "styleDirection"])),
    bodyFit: normalize(readNestedString(onboarding, ["body", "fit"])) || normalize(readNestedString(finalResult, ["bodyVisagism", "generalFit"])),
    lookNames: Array.isArray(finalResult?.looks)
      ? (finalResult.looks as Array<Record<string, unknown>>).map((look) => normalize((look.name as string | undefined) || (look.explanation as string | undefined)))
      : [],
  };
}

function buildCandidatePool(leads: LeadRow[], savedResults: SavedResultRow[]) {
  const payloadById = new Map(savedResults.map((row) => [row.id, row.payload]));
  return leads.map((lead) => {
    const payload = lead.saved_result_id ? payloadById.get(lead.saved_result_id) || null : null;
    const signals = leadSignalsFromPayload(payload);
    const lastInteraction = lead.last_interaction_at || lead.updated_at || lead.created_at || null;

    return {
      lead,
      payload,
      signals,
      lastInteraction,
      lastInteractionTime: lastInteraction ? new Date(lastInteraction).getTime() : 0,
    };
  });
}

function selectCandidates(
  campaignType: CampaignType,
  pool: ReturnType<typeof buildCandidatePool>,
  products: ProductRow[],
  payload: Record<string, unknown>
) {
  const now = Date.now();
  const productId = normalize(payload.productId);
  const product =
    (productId ? products.find((row) => row.id === productId) : null) ||
    products[0] ||
    null;

  if (campaignType === "new_collection" || campaignType === "dead_stock") {
    if (!product) {
      return { product: null, candidates: [] as typeof pool };
    }
  }

  const productTokens = product ? getProductTokens(product, payload) : [];

  const filtered = pool.filter(({ lead, signals, lastInteractionTime }) => {
    const status = normalizeLower(lead.status);
    const phone = normalize(lead.phone || lead.whatsapp_key);
    if (!phone) return false;
    if (status === "won" || status === "lost") return false;

    if (campaignType === "reengagement") {
      return now - lastInteractionTime >= 7 * 24 * 60 * 60 * 1000;
    }

    if (campaignType === "tryon_followup") {
      return now - lastInteractionTime >= 60 * 60 * 1000 && now - lastInteractionTime <= 24 * 60 * 60 * 1000;
    }

    if (campaignType === "anniversary") {
      const created = lead.created_at ? new Date(lead.created_at) : null;
      if (!created || Number.isNaN(created.getTime())) return false;
      const today = new Date();
      return created.getMonth() === today.getMonth() && created.getDate() === today.getDate();
    }

    if (campaignType === "new_collection" || campaignType === "dead_stock") {
      const { matches, conflicts } = paletteMatchScore(signals.favoriteColors, signals.avoidColors, productTokens);
      const styleMatches = tokenOverlapScore([signals.styleIdentity, signals.styleDirection, signals.bodyFit, ...signals.lookNames], productTokens);
      const styleIntent = tokenOverlapScore([normalize(payload.productStyle), normalize(payload.productCategory), normalize(payload.lookName)], productTokens);
      if (campaignType === "dead_stock") {
        return matches > 0 || conflicts === 0 || styleMatches > 0 || styleIntent > 0 || (lead.intent_score ?? 0) >= 60;
      }
      return matches > 0 || styleMatches > 0 || styleIntent > 0 || (signals.favoriteColors.length === 0 && (lead.intent_score ?? 0) >= 60);
    }

    return false;
  });

  return {
    product,
    candidates: filtered.sort((left, right) => right.lastInteractionTime - left.lastInteractionTime),
  };
}

function buildCampaignTone(campaignType: CampaignType) {
  if (campaignType === "anniversary") return "elegant" as const;
  if (campaignType === "tryon_followup") return "concise" as const;
  if (campaignType === "dead_stock") return "persuasive" as const;
  return "premium" as const;
}

function buildCampaignObjective(campaignType: CampaignType) {
  if (campaignType === "new_collection") return "novidades" as const;
  if (campaignType === "reengagement") return "recuperar_inativo" as const;
  if (campaignType === "tryon_followup") return "pos_compra" as const;
  if (campaignType === "anniversary") return "recompra" as const;
  return "cross_sell" as const;
}

async function sendCampaignMessage(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  slug: string,
  integrationToken: string,
  phoneNumberId: string,
  lead: LeadRow,
  message: string,
  campaignType: CampaignType
) {
  const phone = normalize(lead.phone || lead.whatsapp_key);
  if (!phone) {
    return { sent: false, reason: "missing_phone" };
  }

  const payload = await sendMetaWhatsAppTextMessage({
    accessToken: integrationToken,
    phoneNumberId,
    to: phone,
    text: message,
    previewUrl: false,
  });

  const metaMessageId = payload.messages?.[0]?.id || null;

  const { error } = await admin.from("campaign_logs").insert({
    org_id: orgId,
    campaign_type: campaignType,
    client_phone: phone,
    message,
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("[campaigns/auto] failed to persist log", error.message);
  }

  return { sent: true, metaMessageId, phone, slug };
}

export async function POST(req: NextRequest) {
  let body: CampaignBody;

  try {
    body = (await req.json()) as CampaignBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const orgId = normalize(body.orgId);
  const campaignType = normalizeLower(body.campaignType) as CampaignType;
  const payload = body.payload || {};

  const validTypes: CampaignType[] = ["new_collection", "reengagement", "tryon_followup", "anniversary", "dead_stock"];
  if (!orgId || !validTypes.includes(campaignType)) {
    return NextResponse.json({ error: "Missing orgId or campaignType" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin.from("orgs").select("id, slug, name").eq("id", orgId).maybeSingle();
  if (orgError || !org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const integration = await loadMetaIntegrationByOrgId(admin, orgId).catch(() => null);
  if (!integration) {
    return NextResponse.json({ error: "WhatsApp integration not found" }, { status: 409 });
  }

  const accessToken = decryptStoredMetaIntegrationToken(integration);
  const phoneNumberId = normalize(integration.phone_number_id);
  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: "WhatsApp integration is incomplete" }, { status: 409 });
  }

  const { leads, savedResults, products } = await loadEligibleData(admin, orgId);
  const pool = buildCandidatePool(leads, savedResults);
  const { candidates, product } = selectCandidates(campaignType, pool, products, payload);
  const limited = candidates.slice(0, 30);

  const results: Array<{ phone: string; sent: boolean; metaMessageId?: string | null; error?: string }> = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const candidate of limited) {
    try {
      const reply = await buildReplyForLead(orgId, candidate.lead, payload, campaignType, product);
      const fallbackReply = generateWACopy(buildCampaignObjective(campaignType) as never, campaignType === "tryon_followup" ? "alta_intencao" : "inativos", buildCampaignTone(campaignType) as never);
      const message = normalize(reply) || `${fallbackReply.headline}: ${fallbackReply.body} ${fallbackReply.cta}`.trim();
      const sendResult = await sendCampaignMessage(admin, orgId, org.slug, accessToken, phoneNumberId, candidate.lead, message, campaignType);
      results.push({ phone: sendResult.phone || normalize(candidate.lead.phone || candidate.lead.whatsapp_key), sent: true, metaMessageId: sendResult.metaMessageId || null });
      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      results.push({
        phone: normalize(candidate.lead.phone || candidate.lead.whatsapp_key),
        sent: false,
        error: error instanceof Error ? error.message : "Failed to send campaign message",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    orgId,
    campaignType,
    eligibleCount: limited.length,
    sentCount,
    failedCount,
    product: product
      ? {
          id: product.id,
          name: product.name,
        }
      : null,
    results,
  });
}
