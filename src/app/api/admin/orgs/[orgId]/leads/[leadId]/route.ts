import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { resolveAgencySession } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLeadStatus, type LeadStatus, updateLeadOperationalState } from "@/lib/leads";
import { createLeadStateIdempotencyKey } from "@/lib/reliability/idempotency";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orgId: string;
    leadId: string;
  }>;
};

function readStatus(value: FormDataEntryValue | null): LeadStatus | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (isLeadStatus(raw)) {
    return raw;
  }
  return null;
}

function normalizePath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : fallback;
}

function readOptionalKey(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
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
    const hasFollowUpField = formData.has("next_follow_up_at");
    const { timestamp: nextFollowUpAt, error: followUpError } = readOptionalTimestamp(formData.get("next_follow_up_at"));
    const redirectTo = normalizePath(formData.get("redirect_to"), `/agency/orgs/${orgId}`);

    if (followUpError) {
      return NextResponse.json({ error: followUpError }, { status: 400 });
    }

    if (!status && !hasFollowUpField) {
      return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
    }

    const { data: currentLead, error: currentLeadError } = await supabase
      .from("leads")
      .select("id, org_id, status, next_follow_up_at, name, email, phone, source, updated_at")
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

    const updateInput: Parameters<typeof updateLeadOperationalState>[1] = {
      orgId,
      leadId,
      ...(status ? { status } : {}),
      ...(hasFollowUpField ? { nextFollowUpAt } : {}),
      actorUserId: agencySession.user.id,
      eventSource: "agency",
      expectedUpdatedAt: currentLead.updated_at || null,
      idempotencyKey: readOptionalKey(formData.get("idempotency_key")) || createLeadStateIdempotencyKey({
        orgId,
        leadId,
        hasStatus: Boolean(status),
        status,
        hasNextFollowUpAt: hasFollowUpField,
        nextFollowUpAt: hasFollowUpField ? nextFollowUpAt : null,
        expectedUpdatedAt: currentLead.updated_at || null,
      }),
    };

    await updateLeadOperationalState(supabase, updateInput);

    revalidatePath(`/agency/orgs/${orgId}`);
    revalidatePath("/agency");

    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead action failed";
    const status = message === "Agency access denied" ? 403 : message === "Lead changed while editing" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
