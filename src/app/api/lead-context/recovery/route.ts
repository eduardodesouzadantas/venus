import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLeadContextByIdentity } from "@/lib/lead-context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const resultId = url.searchParams.get("result_id");
    const orgId = url.searchParams.get("org_id");

    if (!resultId || !orgId) {
        return NextResponse.json({ error: "Missing result_id or org_id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    try {
        // Attempt recovery by finding the lead context associated with this result_id
        const { lead, context } = await loadLeadContextByIdentity(supabase, {
            orgId,
            savedResultId: resultId,
        });

        if (!lead || !context) {
            // Secondary attempt: if we can't find by resultId, try to find the most recent lead context for this org
            // (This is a last resort to show SOMETHING)
            const { data: recentLead } = await supabase
                .from("leads")
                .select("id, payload")
                .eq("org_id", orgId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentLead) {
                const { data: recentContext } = await supabase
                    .from("lead_context")
                    .select("*")
                    .eq("org_id", orgId)
                    .eq("user_id", recentLead.id)
                    .maybeSingle();

                if (recentContext) {
                    return NextResponse.json({
                        ok: true,
                        recovered: true,
                        lastTryOn: recentContext.last_tryon,
                        analysis: recentContext.style_profile,
                        tenant: recentContext.profile_data,
                    });
                }
            }

            return NextResponse.json({ error: "No recovery data found" }, { status: 404 });
        }

        return NextResponse.json({
            ok: true,
            recovered: true,
            lastTryOn: context.last_tryon,
            analysis: context.style_profile,
            tenant: context.profile_data,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Recovery failed" },
            { status: 500 }
        );
    }
}
