import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const id = params.id?.trim();
  console.info("[RESULT_API] lookup start", { resultId: id || null });

  if (!id) {
    return NextResponse.json({ error: "Missing result id" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("saved_results")
      .select("id, payload, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[RESULT_API] saved_results lookup failed", {
        resultId: id,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      console.warn("[RESULT_API] lookup miss", { resultId: id });
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const payload = (data.payload ?? {}) as Record<string, unknown>;

    const response = {
      id: data.id,
      analysis: payload.visualAnalysis ?? null,
      finalResult: payload.finalResult ?? null,
      tenant: payload.tenant ?? null,
      lastTryOn: payload.last_tryon ?? null,
      createdAt: data.created_at,
    };
    console.info("[RESULT_API] lookup success", {
      resultId: id,
      orgId: (payload.tenant as Record<string, unknown> | null)?.orgId || null,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[RESULT_API] lookup fail", {
      resultId: id,
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load result" },
      { status: 500 },
    );
  }
}
