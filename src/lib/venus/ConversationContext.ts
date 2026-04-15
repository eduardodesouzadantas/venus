import { createAdminClient } from "@/lib/supabase/admin";
import { loadLeadContextByIdentity } from "@/lib/lead-context";
import { resolveProductStockSnapshot } from "@/lib/catalog/stock";
import type { VenusContext, VenusConversationMessage } from "./types";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function collectRecords(row: Record<string, unknown>) {
  return [row, asRecord(row.metadata), asRecord(row.payload), asRecord(row.data), asRecord(row.context), asRecord(row.onboarding)];
}

function readNestedString(value: unknown, path: string[]) {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return "";
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return normalize(cursor);
}

function pickString(row: Record<string, unknown>, paths: string[][]) {
  const candidates = collectRecords(row);
  for (const candidate of candidates) {
    for (const path of paths) {
      const direct = path.length === 1 ? normalize(candidate[path[0]]) : readNestedString(candidate, path);
      if (direct) {
        return direct;
      }
    }
  }
  return "";
}

function collectFromRows(rows: Array<Record<string, unknown> | null | undefined>, paths: string[][]) {
  for (const row of rows) {
    if (!row) continue;
    const value = pickString(row, paths);
    if (value) {
      return value;
    }
  }
  return "";
}

function formatCatalogLine(product: Record<string, unknown>, stock: number) {
  const name = normalize(product.name) || "Produto sem nome";
  const category = normalize(product.category) || "produto";
  const style = normalize(product.style) || "estilo indefinido";
  const color = normalize(product.primary_color) || "";
  const emotionalCopy = normalize(product.emotional_copy);
  const tags = Array.isArray(product.tags) ? product.tags.map((tag) => normalize(tag)).filter(Boolean).slice(0, 5) : [];

  const parts = [`• ${name}`, category, style, `estoque ${stock}`];

  if (color) {
    parts.push(color);
  }

  if (tags.length) {
    parts.push(`tags ${tags.join(", ")}`);
  }

  if (emotionalCopy) {
    parts.push(emotionalCopy.slice(0, 120));
  }

  return parts.join(" — ");
}

function buildStockSummary(productName: string, productSize: string, productStock: number) {
  if (!productName) {
    return "Sem peça destacada no momento.";
  }

  const sizePart = productSize ? `Tamanho ${productSize}` : "Tamanho não informado";
  if (productStock > 5) {
    return `${productName} — ${sizePart} — estoque saudável com ${productStock} unidades.`;
  }
  if (productStock > 0) {
    return `${productName} — ${sizePart} — estoque reduzido com ${productStock} unidades.`;
  }
  return `${productName} — ${sizePart} — sem estoque disponível agora.`;
}

export async function loadContext(phone_number: string, org_id: string): Promise<VenusContext> {
  const admin = createAdminClient();

  const { data: org } = await admin.from("orgs").select("id, slug, name").eq("id", org_id).maybeSingle();
  if (!org) {
    throw new Error("org_not_found");
  }

  let onboardingData: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from("onboarding_sessions")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    onboardingData = asRecord(data);
  } catch {
    onboardingData = null;
  }

  let savedPayload: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from("saved_results")
      .select("payload, created_at")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    savedPayload = asRecord(data?.payload);
  } catch {
    savedPayload = null;
  }

  let leadSnapshot: Awaited<ReturnType<typeof loadLeadContextByIdentity>> | null = null;
  try {
    leadSnapshot = await loadLeadContextByIdentity(admin, { orgId: org_id, phone: phone_number });
  } catch {
    leadSnapshot = null;
  }

  let productsRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await admin
      .from("products")
      .select("id, name, category, style, primary_color, emotional_copy, tags, size_type, stock_qty, reserved_qty, stock_status, stock, created_at")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(10);
    productsRows = (data || []) as Array<Record<string, unknown>>;
  } catch {
    productsRows = [];
  }

  let wardrobeRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await admin
      .from("wardrobe_items")
      .select("name, category, color, image_url, created_at")
      .eq("client_phone", phone_number)
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(10);
    wardrobeRows = (data || []) as Array<Record<string, unknown>>;
  } catch {
    wardrobeRows = [];
  }

  let conversationData: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("id, user_name, user_phone, user_context, status, last_message, created_at")
      .eq("org_slug", normalize(org.slug))
      .eq("user_phone", phone_number)
      .maybeSingle();
    conversationData = asRecord(data);
  } catch {
    conversationData = null;
  }

  const conversationId = normalize(conversationData?.id);

  let messages: VenusConversationMessage[] = [];
  if (conversationId) {
    try {
      const { data } = await admin
        .from("whatsapp_messages")
        .select("sender, text, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10);
      messages = ((data || []) as Array<Record<string, unknown>>).map((message) => ({
        sender: normalize(message.sender) || "user",
        text: normalize(message.text),
        created_at: normalize(message.created_at) || null,
      }));
    } catch {
      messages = [];
    }
  }

  const onboarding = onboardingData || {};
  const saved = savedPayload || {};
  const leadContext = leadSnapshot?.context || null;
  const leadProfile = asRecord(leadContext?.profile_data);
  const leadStyle = asRecord(leadContext?.style_profile);
  const leadColor = asRecord(leadContext?.colorimetry);
  const leadBody = asRecord(leadContext?.body_analysis);
  const leadWhatsapp = asRecord(leadContext?.whatsapp_context);

  const clientName =
    collectFromRows([leadProfile, leadWhatsapp, asRecord(conversationData?.user_context), onboarding, saved], [["name"], ["client_name"], ["customer_name"], ["user_name"]]) ||
    normalize(conversationData?.user_name) ||
    "Cliente Venus";

  const archetype = collectFromRows([leadStyle, leadProfile, onboarding, asRecord(onboarding.payload), asRecord(onboarding.metadata), saved], [["dominantStyle"], ["styleIdentity"], ["archetype"], ["user_archetype"], ["profile", "archetype"], ["payload", "archetype"]]);
  const palette = collectFromRows([leadColor, leadStyle, onboarding, asRecord(onboarding.payload), asRecord(onboarding.metadata), saved], [["colorSeason"], ["paletteFamily"], ["palette"], ["palette", "name"], ["profile", "palette"]]);
  const fit = collectFromRows([leadBody, leadStyle, onboarding, asRecord(onboarding.payload), asRecord(onboarding.metadata), saved], [["fit"], ["fitPreference"], ["fit_preference"], ["profile", "fit"]]);
  const intention = collectFromRows([leadStyle, leadWhatsapp, onboarding, asRecord(onboarding.payload), asRecord(onboarding.metadata), saved], [["imageGoal"], ["intention"], ["mainIntention"], ["main_intention"], ["goal"], ["profile", "intention"]]);

  const look = collectFromRows([leadWhatsapp, leadStyle, leadBody, saved, asRecord(onboarding.payload), onboarding], [["look"], ["product_name"], ["productName"], ["product"], ["focus_product"], ["product_interest"]]);
  const productName = collectFromRows([leadWhatsapp, leadStyle, saved, asRecord(onboarding.payload), onboarding], [["product_name"], ["productName"], ["focus_product"], ["product_interest"], ["look"]]);
  const productCategory = collectFromRows([leadWhatsapp, saved, asRecord(onboarding.payload), onboarding], [["product_category"], ["productCategory"], ["category"]]);
  const productStyle = collectFromRows([leadStyle, saved, asRecord(onboarding.payload), onboarding], [["product_style"], ["productStyle"], ["style"]]);
  const productColor = collectFromRows([leadColor, saved, asRecord(onboarding.payload), onboarding], [["product_color"], ["dominant_color"], ["color"], ["primary_color"]]);
  const productSize = collectFromRows([leadBody, saved, asRecord(onboarding.payload), onboarding], [["size"], ["product_size"], ["productSize"], ["variant_size"]]);

  const focusedProductName = normalize(productName || look).toLowerCase();
  const stockByProductId = new Map<string, number>();

  if (productsRows.length > 0) {
    const ids = productsRows.map((product) => normalize(product.id)).filter(Boolean);
    if (ids.length > 0) {
      try {
        const { data } = await admin
          .from("product_variants")
          .select("product_id, size, quantity, active")
          .eq("org_id", org_id)
          .in("product_id", ids);

        for (const row of (data || []) as Array<Record<string, unknown>>) {
          const productId = normalize(row.product_id);
          if (!productId || row.active === false) continue;
          const quantity = Number(row.quantity || 0);
          stockByProductId.set(productId, (stockByProductId.get(productId) || 0) + (Number.isFinite(quantity) ? quantity : 0));
        }
      } catch {
        // Sem variantes ainda.
      }
    }
  }

  let productStock = 0;
  const catalogLines = productsRows.map((product) => {
    const productId = normalize(product.id);
    const stockSnapshot = resolveProductStockSnapshot(product, stockByProductId.get(productId) || 0);
    const stock = stockSnapshot.availableQty;
    if (focusedProductName && normalize(product.name).toLowerCase().includes(focusedProductName)) {
      productStock = stock;
    }
    return formatCatalogLine(product, stock);
  });

  const wardrobeLines = wardrobeRows.map((item) => {
    const name = normalize(item.name) || "Peça registrada";
    const category = normalize(item.category) || "categoria indefinida";
    const color = normalize(item.color) || "cor não informada";
    return `${name} — ${category} — ${color}`;
  });

  if (!productStock && productsRows[0]) {
    productStock = resolveProductStockSnapshot(productsRows[0], stockByProductId.get(normalize(productsRows[0].id)) || 0).availableQty;
  }

  const resolvedProductName = productName || normalize(productsRows[0]?.name) || "";
  const resolvedProductSize = productSize || normalize((productsRows[0] as Record<string, unknown> | undefined)?.size_type) || "";
  const stockSummary = buildStockSummary(resolvedProductName, resolvedProductSize, productStock);

  return {
    orgId: normalize(org.id),
    orgSlug: normalize(org.slug),
    orgName: normalize(org.name) || normalize(org.slug),
    clientName,
    clientPhone: phone_number,
    archetype: archetype || "Em descoberta",
    palette: palette || "Paleta aberta",
    fit: fit || "A definir",
    intention: intention || "Sem intenção registrada",
    look: look || resolvedProductName,
    productName: resolvedProductName,
    productCategory: productCategory || normalize(productsRows[0]?.category) || "",
    productStyle: productStyle || normalize(productsRows[0]?.style) || "",
    productColor: productColor || normalize(productsRows[0]?.primary_color) || "",
    productSize: resolvedProductSize,
    productStock,
    stockSummary,
    catalogSummary: catalogLines.join("\n"),
    wardrobeSummary: wardrobeLines.join("\n"),
    history: messages,
    state: "curiosidade",
    decision: leadWhatsapp?.nextAction ? {
      action: String(leadWhatsapp.nextAction),
      reason: String(leadWhatsapp.nextActionReason || ""),
      payload: leadWhatsapp.payload || {}
    } : undefined
  };
}

export const loadConversationContext = loadContext;
