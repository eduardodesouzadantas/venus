import { VenusContext } from "./VenusStylist";

export async function loadConversationContext(
  admin: any,
  orgId: string,
  orgSlug: string,
  orgName: string,
  userPhone: string,
  userName: string,
  conversationId: string
): Promise<VenusContext> {
  const { data: messages } = await admin
    .from("whatsapp_messages")
    .select("sender, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(8);

  const history = (messages || []).reverse().map((m: any) => ({
    sender: m.sender,
    text: m.text,
  }));

  const { data: lead } = await admin
    .from("leads")
    .select("name, metadata, intent_score")
    .eq("org_id", orgId)
    .eq("whatsapp_key", userPhone)
    .maybeSingle();

  const { data: savedResult } = await admin
    .from("saved_results")
    .select("payload")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: products } = await admin
    .from("products")
    .select("name, category, style, price_range, primary_color")
    .eq("org_id", orgId)
    .limit(5);

  const catalogSummary =
    products?.map((p: any) => `• ${p.name} (${p.category || ""}) — ${p.style || ""} — ${p.price_range || ""}`).join("\n") || "";

  const meta = (lead?.metadata || {}) as Record<string, any>;
  const payload = (savedResult?.payload || {}) as Record<string, any>;

  return {
    orgName,
    orgSlug,
    clientName: lead?.name || userName,
    clientPhone: userPhone,
    archetype: meta.archetype || payload.archetype,
    palette: meta.palette || payload.palette,
    fitPreference: meta.fit_preference || payload.fitPreference,
    mainIntention: meta.main_intention || payload.mainIntention,
    styleBlock: meta.style_block || payload.styleBlock,
    productName: payload.product_name || payload.productName,
    productCategory: payload.product_category || payload.category,
    productStyle: payload.product_style || payload.style,
    productPriceRange: payload.price_range,
    inStock: true,
    catalogSummary,
    conversationHistory: history,
    conversationState: "general",
  };
}
