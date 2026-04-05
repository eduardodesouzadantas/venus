import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { resolveAgencySession } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaybookActionMeta, isOrgPlaybookActionKey } from "@/lib/billing/playbooks";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orgId: string;
  }>;
};

function normalizePath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const agencySession = await resolveAgencySession();
    const formData = await request.formData();
    const actionValue = formData.get("action");
    const redirectTo = normalizePath(formData.get("redirect_to"), `/agency/orgs/${orgId}`);

    const rawAction = typeof actionValue === "string" ? actionValue.trim() : "";
    if (!isOrgPlaybookActionKey(rawAction)) {
      return NextResponse.json({ error: "Invalid playbook action" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("orgs")
      .select("id, slug, name, status, kill_switch, plan_id")
      .eq("id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Failed to load org: ${error.message}` }, { status: 400 });
    }

    if (!org) {
      return NextResponse.json({ error: "Org not found" }, { status: 404 });
    }

    const meta = getPlaybookActionMeta(rawAction);
    const { error: eventError } = await admin.from("tenant_events").insert({
      org_id: org.id,
      actor_user_id: agencySession.user.id,
      event_type: meta.event_type,
      event_source: "agency",
      dedupe_key: `agency:playbook:${org.id}:${rawAction}:${Date.now()}`,
      payload: {
        org_id: org.id,
        org_slug: org.slug,
        org_name: org.name,
        playbook_action_key: rawAction,
        playbook_action_label: meta.label,
        playbook_action_description: meta.description,
        status: org.status,
        kill_switch: org.kill_switch,
        plan_id: org.plan_id,
      },
    });

    if (eventError) {
      return NextResponse.json({ error: `Failed to register playbook action: ${eventError.message}` }, { status: 400 });
    }

    revalidatePath("/agency");
    revalidatePath("/agency/billing");
    revalidatePath(`/agency/orgs/${org.id}`);

    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playbook action failed";
    const status = message === "Agency access denied" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
