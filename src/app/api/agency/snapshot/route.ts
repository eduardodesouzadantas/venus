import { NextRequest, NextResponse } from "next/server";

import {
  getAgencyOperationalFrictionSummary,
  listAgencyMerchantGroups,
  listAgencyOrgRows,
  resolveAgencySession,
} from "@/lib/agency";
import { normalizeAgencyTimeRange } from "@/lib/agency/time-range";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  }) as Promise<T | null>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveAgencySession();

    const url = new URL(request.url);
    const range = normalizeAgencyTimeRange(url.searchParams.get("range") || "all", "all");
    const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";

    const payload = await withTimeout(
      Promise.all([listAgencyOrgRows(), listAgencyMerchantGroups(session.orgId), getAgencyOperationalFrictionSummary(range)]),
      TIMEOUT_MS
    );

    if (!payload) {
      return NextResponse.json({});
    }

    const [rows, merchantGroups, operationalSummary] = payload;

    return NextResponse.json(
      {
        ok: true,
        data: {
          agency_org_id: session.orgId,
          range,
          theme,
          operational_events: operationalSummary.total_events,
          merchant_groups: merchantGroups,
          rows: rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            group_id: row.group_id || null,
            branch_name: row.branch_name || null,
            status: row.status,
            kill_switch: row.kill_switch,
            plan_id: row.plan_id,
            created_at: row.created_at,
            last_activity_at: row.last_activity_at,
            total_members: row.total_members,
            total_products: row.total_products,
            total_leads: row.total_leads,
            total_saved_results: row.total_saved_results,
            total_whatsapp_conversations: row.total_whatsapp_conversations,
            total_whatsapp_messages: row.total_whatsapp_messages,
            lead_summary: {
              total: row.lead_summary.total,
              by_status: row.lead_summary.by_status,
              followup_overdue: row.lead_summary.followup_overdue,
              followup_without: row.lead_summary.followup_without,
            },
          })),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json({});
  }
}
