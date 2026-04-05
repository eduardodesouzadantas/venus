import { NextResponse, type NextRequest } from "next/server";

import { resolveAgencySession } from "@/lib/agency";
import { normalizeAgencyTimeRange } from "@/lib/agency/time-range";
import { listAgencyPlaybookRows } from "@/lib/billing/playbooks";
import { rowsToCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

function normalize(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function firstParam(searchParams: URLSearchParams, key: string) {
  return normalize(searchParams.get(key));
}

function filename(range: string, format: string) {
  return `agency-billing-${range || "all"}.${format}`;
}

export async function GET(request: NextRequest) {
  try {
    await resolveAgencySession();

    const searchParams = request.nextUrl.searchParams;
    const range = normalizeAgencyTimeRange(firstParam(searchParams, "range"), "all");
    const orgId = firstParam(searchParams, "orgId") || null;
    const format = firstParam(searchParams, "format") === "csv" ? "csv" : "json";

    const filters = {
      range,
      orgId,
    };

    const rows = await listAgencyPlaybookRows(filters);
    const totalOrgs = rows.length;
    const estimatedToday = rows.reduce((sum, row) => sum + row.estimated_cost_today_cents, 0);
    const estimatedTotal = rows.reduce((sum, row) => sum + row.estimated_cost_total_cents, 0);
    const latestUsageDate = rows.reduce<string | null>((current, row) => {
      if (!row.usage_date) return current;
      if (!current || row.usage_date > current) return row.usage_date;
      return current;
    }, null);

    if (format === "csv") {
      const csv = rowsToCsv(rows, [
        { header: "org_id", value: (row) => row.id },
        { header: "org_name", value: (row) => row.name },
        { header: "slug", value: (row) => row.slug },
        { header: "status", value: (row) => row.status },
        { header: "plan_id", value: (row) => row.plan_id || "" },
        { header: "kill_switch", value: (row) => row.kill_switch ? "true" : "false" },
        { header: "total_products", value: (row) => row.total_products },
        { header: "total_leads", value: (row) => row.total_leads },
        { header: "total_saved_results", value: (row) => row.total_saved_results },
        { header: "total_whatsapp_conversations", value: (row) => row.total_whatsapp_conversations ?? "" },
        { header: "total_whatsapp_messages", value: (row) => row.total_whatsapp_messages ?? "" },
        { header: "tenant_events_count", value: (row) => row.tenant_events_count },
        { header: "usage_date", value: (row) => row.usage_date || "" },
        { header: "last_activity_at", value: (row) => row.last_activity_at || "" },
        { header: "estimated_cost_today_cents", value: (row) => row.estimated_cost_today_cents },
        { header: "estimated_cost_total_cents", value: (row) => row.estimated_cost_total_cents },
        { header: "billing_risk", value: (row) => row.billing_risk },
        { header: "usage_health", value: (row) => row.usage_health },
        { header: "guidance_level", value: (row) => row.guidance_summary.guidance_level },
        { header: "recommended_action", value: (row) => row.guidance_summary.recommended_action },
        { header: "suggested_plan_if_any", value: (row) => row.playbook_summary.suggested_plan_if_any || "" },
      ]);

      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename(range, format)}"`,
        },
      });
    }

    return NextResponse.json(
      {
        meta: {
          range,
          orgId,
          format,
          totalOrgs,
          estimatedToday,
          estimatedTotal,
          latestUsageDate,
        },
        rows,
      },
      {
        headers: {
          "content-disposition": `attachment; filename="${filename(range, format)}"`,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const status = message === "Agency access denied" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
