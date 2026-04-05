import { NextResponse, type NextRequest } from "next/server";

import { resolveAgencySession } from "@/lib/agency";
import { normalizeAgencyTimeRange } from "@/lib/agency/time-range";
import { listPlaybookQueueItems, getPlaybookQueueSummary, type PlaybookQueueActionType } from "@/lib/agency/playbook-queue";
import { rowsToCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

function normalize(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function firstParam(searchParams: URLSearchParams, key: string) {
  return normalize(searchParams.get(key));
}

function actionTypeFromParam(value: string) {
  return value.startsWith("agency.") ? (value as PlaybookQueueActionType) : null;
}

function filename(range: string, format: string) {
  return `agency-playbooks-${range || "all"}.${format}`;
}

export async function GET(request: NextRequest) {
  try {
    await resolveAgencySession();

    const searchParams = request.nextUrl.searchParams;
    const range = normalizeAgencyTimeRange(firstParam(searchParams, "range"), "all");
    const orgId = firstParam(searchParams, "orgId") || null;
    const actionType = actionTypeFromParam(firstParam(searchParams, "actionType"));
    const limit = Number(firstParam(searchParams, "limit")) || 100;
    const format = firstParam(searchParams, "format") === "csv" ? "csv" : "json";

    const filters = {
      range,
      orgId,
      actionType,
      limit,
    };

    const [rows, summary] = await Promise.all([
      listPlaybookQueueItems(filters),
      getPlaybookQueueSummary(filters),
    ]);

    if (format === "csv") {
      const csv = rowsToCsv(rows, [
        { header: "event_id", value: (row) => row.event_id },
        { header: "org_id", value: (row) => row.org_id },
        { header: "org_name", value: (row) => row.org_name },
        { header: "org_slug", value: (row) => row.org_slug },
        { header: "action_type", value: (row) => row.action_type },
        { header: "label", value: (row) => row.label },
        { header: "created_at", value: (row) => row.created_at },
        { header: "status_light", value: (row) => row.status_light },
        { header: "metadata_json", value: (row) => JSON.stringify(row.metadata) },
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
          actionType,
          limit,
          format,
        },
        summary,
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

