import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { resolveAgencySession } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { type LeadStatus, updateLeadOperationalState } from "@/lib/leads";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orgId: string;
    leadId: string;
  }>;
};

function readStatus(value: FormDataEntryValue | null): LeadStatus | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "new" || raw === "engaged" || raw === "qualified" || raw === "offer_sent" || raw === "won" || raw === "lost") {
    return raw;
  }
  return null;
}

function normalizePath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : fallback;
}

function readOptionalTimestamp(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return { timestamp: null as string | null, error: null as string | null };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { timestamp: null as string | null, error: "Invalid follow-up datetime" };
  }

  return { timestamp: parsed.toISOString(), error: null as string | null };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orgId, leadId } = await context.params;
    const agencySession = await resolveAgencySession();
    const supabase = createAdminClient();
    const formData = await request.formData();
    const status = readStatus(formData.get("status"));
    const { timestamp: nextFollowUpAt, error: followUpError } = readOptionalTimestamp(formData.get("next_follow_up_at"));
    const redirectTo = normalizePath(formData.get("redirect_to"), `/agency/orgs/${orgId}`);

    if (followUpError) {
      return NextResponse.json({ error: followUpError }, { status: 400 });
    }

    if (!status && nextFollowUpAt === null) {
      return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
    }

    const { data: currentLead, error: currentLeadError } = await supabase
      .from("leads")
      .select("id, org_id, status, next_follow_up_at, name, email, phone, source")
      .eq("org_id", orgId)
      .eq("id", leadId)
      .maybeSingle();

    if (currentLeadError) {
      return NextResponse.json({ error: `Failed to load lead: ${currentLeadError.message}` }, { status: 400 });
    }

    if (!currentLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const currentFollowUpAt = currentLead.next_follow_up_at ? new Date(currentLead.next_follow_up_at).toISOString() : null;
    const followUpChanged = nextFollowUpAt !== currentFollowUpAt;
    const statusChanged = Boolean(status && status !== currentLead.status);

    if (!statusChanged && !followUpChanged) {
      revalidatePath(`/agency/orgs/${orgId}`);
      revalidatePath("/agency");
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    const { data: org, error: orgError } = await supabase
      .from("orgs")
      .select("slug")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      return NextResponse.json({ error: `Failed to load org: ${orgError.message}` }, { status: 400 });
    }

    const { lead } = await updateLeadOperationalState(supabase, {
      orgId,
      leadId,
      status: status || undefined,
      nextFollowUpAt,
    });

    const { error: eventError } = await supabase.from("tenant_events").insert({
      org_id: orgId,
      actor_user_id: agencySession.user.id,
      event_type: statusChanged ? "lead.status_updated" : "lead.follow_up_updated",
      event_source: "agency",
      dedupe_key: `lead:state:${orgId}:${leadId}:${status || "noop"}:${nextFollowUpAt || "clear"}:${Date.now()}`,
      payload: {
        lead_id: lead.id,
        org_id: orgId,
        org_slug: org?.slug || null,
        previous_status: currentLead.status,
        next_status: lead.status,
        previous_follow_up_at: currentLead.next_follow_up_at,
        next_follow_up_at: lead.next_follow_up_at,
        lead_name: currentLead.name,
        lead_email: currentLead.email,
        lead_phone: currentLead.phone,
        lead_source: currentLead.source,
        updated_fields: {
          status: statusChanged,
          next_follow_up_at: followUpChanged,
        },
      },
    });

    if (eventError) {
      return NextResponse.json({ error: `Lead updated but audit event failed: ${eventError.message}` }, { status: 400 });
    }

    revalidatePath(`/agency/orgs/${orgId}`);
    revalidatePath("/agency");

    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead action failed";
    const status = message === "Agency access denied" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
