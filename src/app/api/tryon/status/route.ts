import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTryOnStatus, getTryOnResult } from "@/lib/tryon/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("id");
  const orgId = req.nextUrl.searchParams.get("org_id");

  if (!requestId || !orgId) {
    return NextResponse.json({ error: "Missing id or org_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verificar que o evento pertence à org do usuário
  const { data: event } = await supabase
    .from("tryon_events")
    .select("id, status, result_image_url")
    .eq("fal_request_id", requestId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Try-on event not found" }, { status: 404 });
  }

  // Se já temos o resultado em cache, retornar sem chamar a API
  if (event.status === "completed" && event.result_image_url) {
    return NextResponse.json({ status: "completed", image_url: event.result_image_url });
  }

  if (event.status === "failed") {
    return NextResponse.json({ status: "failed" });
  }

  try {
    const falStatus = await getTryOnStatus(requestId);
    // Cast to string to handle all status values including any not in the SDK union type
    const statusStr = String(falStatus.status);

    if (statusStr === "COMPLETED") {
      const result = await getTryOnResult(requestId);
      const imageUrl = result.images[0]?.url ?? null;

      // 1. Atualizar evento técnico
      await supabase
        .from("tryon_events")
        .update({
          status: "completed",
          result_image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq("fal_request_id", requestId)
        .eq("org_id", orgId);

      // 2. Persistência Canônica no contexto do Lead
      const { data: eventWithResult } = await supabase
        .from("tryon_events")
        .select("saved_result_id, product_id, products(name, image_url)")
        .eq("fal_request_id", requestId)
        .single();

      if (eventWithResult?.saved_result_id) {
        const { data: savedResult } = await supabase
          .from("saved_results")
          .select("payload")
          .eq("id", eventWithResult.saved_result_id)
          .single();

        if (savedResult) {
          const payload = (savedResult.payload || {}) as any;
          const product = (eventWithResult.products as any) || {};

          const lastTryOn = {
            image_url: imageUrl,
            product_id: eventWithResult.product_id,
            product_name: product.name,
            product_image: product.image_url,
            generated_at: new Date().toISOString(),
            provider: "fal_ai",
            status: "completed",
            style_reason: "Look gerado com base na sua colorimetria e biótipo.",
            cta_state: "ready_for_whatsapp"
          };

          const newPayload = {
            ...payload,
            last_tryon: lastTryOn,
            // Incrementar intenção operacional
            intent_delta: (payload.intent_delta || 0) + 15
          };

          await supabase
            .from("saved_results")
            .update({ payload: newPayload })
            .eq("id", eventWithResult.saved_result_id);

          // Atualizar lead se existir
          await supabase
            .from("leads")
            .update({
              intent_score: Math.min(100, (payload.onboardingContext?.intent?.satisfaction * 10 || 50) + (newPayload.intent_delta || 0)),
              updated_at: new Date().toISOString()
            })
            .eq("saved_result_id", eventWithResult.saved_result_id);
        }
      }

      return NextResponse.json({ status: "completed", image_url: imageUrl });
    }

    if (statusStr === "FAILED") {
      await supabase
        .from("tryon_events")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("fal_request_id", requestId);

      return NextResponse.json({ status: "failed" });
    }

    const mappedStatus = statusStr === "IN_PROGRESS" ? "processing" : "queued";
    return NextResponse.json({ status: mappedStatus });
  } catch (error) {
    console.error("[tryon/status] Error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
