import { NextResponse, type NextRequest } from "next/server";

import { resolveAgencySession } from "@/lib/agency";
import { normalizeAgencyTimeRange } from "@/lib/agency/time-range";
import { getAgencyOrgExportDetail } from "@/lib/agency/org-details";
import { rowsToCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

function normalize(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function firstParam(searchParams: URLSearchParams, key: string) {
  return normalize(searchParams.get(key));
}

function filename(orgId: string, range: string, format: string) {
  return `agency-org-${orgId}-${range || "all"}.${format}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await resolveAgencySession();

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const range = normalizeAgencyTimeRange(firstParam(searchParams, "range"), "all");
    const from = firstParam(searchParams, "from") || null;
    const format = firstParam(searchParams, "format") === "csv" ? "csv" : "json";

    const exported = await getAgencyOrgExportDetail(orgId, range);

    if (!exported) {
      return NextResponse.json({ error: "Org not found" }, { status: 404 });
    }

    const { detail, summary } = exported;

    if (format === "csv") {
      const csv = rowsToCsv([summary], [
        { header: "org_id", value: (row) => row.org_id },
        { header: "org_name", value: (row) => row.org_name },
        { header: "org_slug", value: (row) => row.org_slug },
        { header: "status", value: (row) => row.status },
        { header: "plan_id", value: (row) => row.plan_id || "" },
        { header: "kill_switch", value: (row) => (row.kill_switch ? "true" : "false") },
        { header: "range", value: () => range },
        { header: "total_members", value: (row) => row.total_members },
        { header: "total_products", value: (row) => row.total_products },
        { header: "total_leads", value: (row) => row.total_leads },
        { header: "total_saved_results", value: (row) => row.total_saved_results },
        { header: "recent_whatsapp_conversations_count", value: (row) => row.recent_whatsapp_conversations_count ?? "" },
        { header: "recent_whatsapp_messages_count", value: (row) => row.recent_whatsapp_messages_count ?? "" },
        { header: "usage_date", value: (row) => row.usage_date || "" },
        { header: "last_activity_at", value: (row) => row.last_activity_at || "" },
        { header: "estimated_cost_today_cents", value: (row) => row.estimated_cost_today_cents },
        { header: "estimated_cost_total_cents", value: (row) => row.estimated_cost_total_cents },
        { header: "usage_health", value: (row) => row.usage_health || "" },
        { header: "billing_risk", value: (row) => row.billing_risk || "" },
        { header: "overall_status", value: (row) => row.overall_status || "" },
        { header: "guidance_level", value: (row) => row.guidance_level || "" },
        { header: "recommended_action", value: (row) => row.recommended_action || "" },
        { header: "suggested_plan_if_any", value: (row) => row.suggested_plan_if_any || "" },
        { header: "playbook_title", value: (row) => row.playbook_title || "" },
        { header: "playbook_summary", value: (row) => row.playbook_summary || "" },
        { header: "recent_events_count", value: (row) => row.recent_events_count },
        { header: "recent_queue_count", value: (row) => row.recent_queue_count },
        { header: "recent_leads_count", value: (row) => row.recent_leads_count },
        { header: "recent_products_count", value: (row) => row.recent_products_count },
        { header: "recent_saved_results_count", value: (row) => row.recent_saved_results_count },
      ]);

      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename(summary.org_id, range, format)}"`,
        },
      });
    }

    return NextResponse.json(
      {
        meta: {
          orgId: summary.org_id,
          range,
          from,
          format,
          exportedAt: new Date().toISOString(),
        },
        org: detail.org,
        summary,
        billing: detail.billing,
        guidance: detail.guidance,
        playbook: detail.playbook,
        recentLeads: detail.leads,
        recentProducts: detail.products,
        recentSavedResults: detail.saved_results,
        whatsapp: detail.whatsapp,
        recentEvents: detail.events,
        recentPlaybookQueue: detail.playbook_queue,
      },
      {
        headers: {
          "content-disposition": `attachment; filename="${filename(summary.org_id, range, format)}"`,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const status = message === "Agency access denied" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
