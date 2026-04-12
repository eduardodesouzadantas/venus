import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLeadContextByIdentity } from "@/lib/lead-context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const resultId = url.searchParams.get("result_id")?.trim();
  const requestedOrgId = url.searchParams.get("org_id")?.trim() || null;

  if (!resultId) {
    return NextResponse.json({ error: "Missing result_id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const { data: savedResult, error: savedResultError } = await supabase
      .from("saved_results")
      .select("id, org_id")
      .eq("id", resultId)
      .maybeSingle();

    if (savedResultError) {
      console.error("[LEAD_CONTEXT][RECOVERY] failed to inspect saved result", {
        resultId,
        error: savedResultError,
      });
      return NextResponse.json({ error: "Failed to inspect saved result" }, { status: 500 });
    }

    let resolvedOrgId = savedResult?.org_id || null;

    if (!resolvedOrgId) {
      const { data: leadBySavedResult, error: leadBySavedResultError } = await supabase
        .from("leads")
        .select("id, org_id, saved_result_id")
        .eq("saved_result_id", resultId)
        .maybeSingle();

      if (leadBySavedResultError) {
        console.error("[LEAD_CONTEXT][RECOVERY] failed to inspect lead by saved result", {
          resultId,
          error: leadBySavedResultError,
        });
        return NextResponse.json({ error: "Failed to resolve recovery tenant" }, { status: 500 });
      }

      resolvedOrgId = leadBySavedResult?.org_id || null;
    }

    if (!resolvedOrgId) {
      console.warn("[LEAD_CONTEXT][RECOVERY] unable to resolve org server-side", {
        resultId,
        requestedOrgId,
      });
      return NextResponse.json({ error: "No recovery data found for this result" }, { status: 404 });
    }

    if (requestedOrgId && requestedOrgId !== resolvedOrgId) {
      console.warn("[LEAD_CONTEXT][RECOVERY] ignoring mismatched frontend org_id", {
        resultId,
        requestedOrgId,
        resolvedOrgId,
      });
    }

    const { lead, context } = await loadLeadContextByIdentity(supabase, {
      orgId: resolvedOrgId,
      savedResultId: resultId,
    });

    if (!lead || !context) {
      const { data: recentLead } = await supabase
        .from("leads")
        .select("id, payload")
        .eq("org_id", resolvedOrgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentLead) {
        try {
          const { data: recentContext, error: recentContextError } = await supabase
            .from("lead_context")
            .select("*")
            .eq("org_id", resolvedOrgId)
            .eq("user_id", recentLead.id)
            .maybeSingle();

          if (recentContextError) {
            console.warn("[LEAD_CONTEXT][RECOVERY] recent context unavailable", {
              resultId,
              resolvedOrgId,
              error: recentContextError,
            });
          }

          if (recentContext) {
            return NextResponse.json({
              ok: true,
              recovered: true,
              resolvedOrgId,
              lastTryOn: recentContext.last_tryon,
              analysis: recentContext.style_profile,
              tenant: recentContext.profile_data,
            });
          }
        } catch (error) {
          console.warn("[LEAD_CONTEXT][RECOVERY] fallback context lookup failed", {
            resultId,
            resolvedOrgId,
            error,
          });
        }
      }

      return NextResponse.json({ error: "No recovery data found for this result" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      recovered: true,
      resolvedOrgId,
      lastTryOn: context.last_tryon,
      analysis: context.style_profile,
      tenant: context.profile_data,
    });
  } catch (error) {
    console.error("[LEAD_CONTEXT][RECOVERY] unexpected failure", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery failed" },
      { status: 500 }
    );
  }
}
