import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const id = params.id?.trim();

  if (!id) {
    return NextResponse.json({ error: "Missing result id" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("saved_results")
      .select("id, payload, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const payload = (data.payload ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      id: data.id,
      analysis: payload.visualAnalysis ?? null,
      finalResult: payload.finalResult ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load result" },
      { status: 500 },
    );
  }
}
