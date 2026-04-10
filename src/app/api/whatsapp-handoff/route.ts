import { createAdminClient } from "@/lib/supabase/admin";
import { enforceOrgHardCap } from "@/lib/billing/enforcement";
import { extractLeadSignalsFromSavedResultPayload, findOrCreateLead } from "@/lib/leads";
import { bumpTenantUsageDaily, resolveAppTenantOrg } from "@/lib/tenant/core";
import { enforceTenantOperationalState } from "@/lib/tenant/enforcement";

type WhatsAppHandoffBody = {
  resultId?: string;
  payload?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as WhatsAppHandoffBody | null;

  if (!body?.resultId || !body.payload) {
    return Response.json({ error: "Missing handoff payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("saved_results")
    .select("id, payload, org_id")
    .eq("id", body.resultId)
    .single();

  if (error || !data) {
    return Response.json({ error: "Saved result not found" }, { status: 404 });
  }

  const currentPayload = (data.payload ?? {}) as Record<string, unknown>;
  const resolvedTenant = data.org_id
    ? null
    : await resolveAppTenantOrg(supabase);
  const org = data.org_id
    ? (await supabase.from("orgs").select("id, slug, status, kill_switch, plan_id, limits, owner_user_id, created_at, updated_at").eq("id", data.org_id).maybeSingle()).data
    : resolvedTenant?.org;

  if (!org) {
    return Response.json({ error: "Unable to resolve tenant for saved result" }, { status: 409 });
  }

  const operationalDecision = await enforceTenantOperationalState({
    orgId: org.id,
    operation: "whatsapp_handoff_sync",
    actorUserId: null,
    eventSource: "whatsapp",
    org: {
      id: org.id,
      slug: org.slug,
      status: org.status,
      kill_switch: org.kill_switch,
      plan_id: org.plan_id,
    },
    metadata: {
      saved_result_id: body.resultId,
      org_slug: org.slug,
    },
  });

  if (!operationalDecision.allowed) {
    return Response.json(
      {
        error: operationalDecision.message || "WhatsApp handoff blocked by tenant state",
        tenant_blocked: true,
        tenant_block_reason: operationalDecision.reason,
        tenant_block_operation: operationalDecision.operation,
      },
      { status: 423 }
    );
  }

  const hardCapDecision = await enforceOrgHardCap({
    orgId: org.id,
    operation: "whatsapp_handoff_sync",
    actorUserId: null,
    eventSource: "whatsapp",
    metadata: {
      saved_result_id: body.resultId,
      org_slug: org.slug,
    },
  });

  if (!hardCapDecision.allowed) {
    return Response.json(
      {
        error: hardCapDecision.message || "WhatsApp handoff blocked by plan limit",
        hard_cap_blocked: true,
        hard_cap_operation: hardCapDecision.operation,
        hard_cap_metric: hardCapDecision.metric,
      },
      { status: 429 }
    );
  }

  const leadSignals = extractLeadSignalsFromSavedResultPayload({
    ...currentPayload,
    whatsappHandoff: body.payload,
  });

  const { error: updateError } = await supabase
    .from("saved_results")
    .update({
      org_id: org.id,
      payload: {
        ...currentPayload,
        tenant: {
          ...(currentPayload.tenant as Record<string, unknown> | undefined),
          orgId: org.id,
          orgSlug: org.slug,
          source: data.org_id ? "existing_org_id" : resolvedTenant?.source || "single_active_org",
        },
        whatsappHandoff: body.payload,
      },
    })
    .eq("id", body.resultId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("tenant_events").insert({
    org_id: org.id,
    actor_user_id: null,
    event_type: "whatsapp_click",
    event_source: "whatsapp",
    dedupe_key: `whatsapp_click:${org.id}:${body.resultId}`,
    payload: {
      saved_result_id: body.resultId,
      org_slug: org.slug,
      timestamp: new Date().toISOString(),
    },
  });

  try {
    const { lead, created } = await findOrCreateLead(supabase, {
      orgId: org.id,
      name: leadSignals.name || null,
      email: leadSignals.email || null,
      phone: leadSignals.phone || null,
      source: "whatsapp",
      status: "engaged",
      savedResultId: body.resultId,
      intentScore: leadSignals.intentScore ?? null,
      whatsappKey: leadSignals.whatsappKey || null,
      lastInteractionAt: leadSignals.lastInteractionAt || undefined,
    });

    await supabase.from("tenant_events").insert({
      org_id: org.id,
      actor_user_id: null,
      event_type: created ? "lead.created_from_whatsapp" : "lead.engaged",
      event_source: "whatsapp",
      dedupe_key: `lead_from_whatsapp:${org.id}:${lead.id}:${body.resultId}`,
      payload: {
        lead_id: lead.id,
        saved_result_id: body.resultId,
        org_slug: org.slug,
        created,
      },
    });

    await bumpTenantUsageDaily(supabase, org.id, { leads: created ? 1 : 0 });
  } catch (leadError) {
    console.warn("[LEADS] failed to sync lead from whatsapp handoff", leadError);
  }

  return Response.json({ ok: true });
}
