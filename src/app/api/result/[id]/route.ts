import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasLegacyTryOnProducts } from "@/lib/result/surface";
import { getCatalogLink } from "@/lib/catalog-query/engine";
import { buildAssistedRecommendationSurface } from "@/lib/catalog-query/presentation";
import { getTenantConfigSummary } from "@/lib/tenant-config";
import type { LookData } from "@/types/result";

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
        },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      console.warn("[RESULT_API] lookup miss", { resultId: id });
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const payload = (data.payload ?? {}) as Record<string, unknown>;
    const finalResult = (payload.finalResult ?? null) as Record<string, unknown> | null;
    const finalLooks = Array.isArray(finalResult?.looks) ? (finalResult?.looks as LookData[]) : [];
    const tenant = (payload.tenant ?? null) as Record<string, unknown> | null;
    const rowOrgId = typeof data.org_id === "string" ? data.org_id.trim() : "";
    const payloadTenantOrgId = typeof tenant?.orgId === "string" ? tenant.orgId.trim() : "";
    const tenantOrgId = payloadTenantOrgId || rowOrgId;
    const normalizedTenant = tenantOrgId
      ? {
        ...(tenant || {}),
        orgId: tenantOrgId,
      }
      : tenant;

    if (!payloadTenantOrgId && rowOrgId) {
      console.warn("[RESULT_API] tenant normalized from saved_results.org_id", {
        resultId: id,
        orgId: rowOrgId,
      });
    }

    const [catalogLink, tenantSummary] = tenantOrgId
      ? await Promise.all([
        getCatalogLink(tenantOrgId).catch(() => "/catalog"),
        getTenantConfigSummary(tenantOrgId).catch(() => null),
      ])
      : ["/catalog", null];

    if (hasLegacyTryOnProducts(finalLooks)) {
      console.warn("[RESULT_API] legacy try-on looks detected", {
        resultId: id,
        orgId: tenantOrgId || null,
        lookIds: finalLooks.map((look) => look?.id || null),
      });
    }

    const assistedRecommendations = buildAssistedRecommendationSurface(finalLooks, {
      limit: 3,
      sourceLabel: tenantSummary?.active_catalog_source || null,
      explicit: false,
    });

    const response = {
      id: data.id,
      analysis: payload.visualAnalysis ?? null,
      finalResult: payload.finalResult ?? null,
      tenant: normalizedTenant ?? null,
      lastTryOn: payload.last_tryon ?? null,
      catalogLink,
      catalogSourceLabel: tenantSummary?.active_catalog_source || null,
      assistedRecommendations,
      createdAt: data.created_at,
    };
    console.info("[RESULT_API] lookup success", {
      resultId: id,
      orgId: tenantOrgId || null,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[RESULT_API] lookup fail", {
      resultId: id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load result" },
      { status: 500 },
    );
  }
}
