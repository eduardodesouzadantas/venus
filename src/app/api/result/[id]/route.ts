import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasLegacyTryOnProducts } from "@/lib/result/surface";

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
      .select("id, org_id, payload, created_at")
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
    const rowOrgId = (data as Record<string, unknown>).org_id as string | null | undefined;
    const tenantFromPayload = (payload.tenant ?? {}) as Record<string, unknown>;
    const payloadOrgId = tenantFromPayload.orgId as string | null | undefined;

    // Canonical org resolution: prefer payload.tenant.orgId, fall back to saved_results.org_id.
    const resolvedOrgId: string | null = payloadOrgId || rowOrgId || null;

    const canonicalTenant: Record<string, unknown> | null = resolvedOrgId
      ? { ...tenantFromPayload, orgId: resolvedOrgId }
      : Object.keys(tenantFromPayload).length > 0
        ? tenantFromPayload
        : null;

    const finalResult = (payload.finalResult ?? null) as Record<string, unknown> | null;
    const finalLooks = Array.isArray(finalResult?.looks) ? (finalResult?.looks as Array<Record<string, unknown>>) : [];
    if (hasLegacyTryOnProducts(finalLooks as any)) {
      console.warn("[RESULT_API] legacy try-on looks detected", {
        resultId: id,
        orgId: resolvedOrgId,
        lookIds: finalLooks.map((look) => look?.id || null),
      });
    }

    const response = {
      id: data.id,
      resultId: data.id,
      orgId: resolvedOrgId,
      analysis: payload.visualAnalysis ?? null,
      finalResult: payload.finalResult ?? null,
      tenant: canonicalTenant,
      lastTryOn: payload.last_tryon ?? null,
      createdAt: data.created_at,
    };

    console.info("[RESULT_API] lookup success", {
      resultId: id,
      orgId: resolvedOrgId,
      hasTenantOrgId: Boolean(payloadOrgId),
      hasRowOrgId: Boolean(rowOrgId),
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
