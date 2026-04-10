"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { extractLeadSignalsFromSavedResultPayload, findOrCreateLead } from "@/lib/leads"
import { bumpTenantUsageDaily, fetchTenantById, resolveAppTenantOrg } from "@/lib/tenant/core"

export async function updateB2CResult(formData: FormData, dbResultId: string) {
  const supabase = createAdminClient()

  // Neste fluxo robusto, não salvamos mais nada novo, damos "UPDATE" 
  // atrelando o E-mail de Lead do cliente à linha de banco recém renderizada por ele.
  const email = formData.get("email") as string
  const name = formData.get("name") as string

  if (!email || !dbResultId) {
    return { error: "E-mail ou Token de Dossiê não encontrado." }
  }

  if (dbResultId === "MOCK_DB_FAIL") {
    return { error: "Impossível salvar. Você está rodando a simulação offline do MVP. Cadastre as chaves na Vercel." }
  }

  const { data: existingRow, error: lookupError } = await supabase
    .from("saved_results")
    .select("id, org_id, payload")
    .eq("id", dbResultId)
    .maybeSingle();

  if (lookupError) {
    return { error: "Erro ao localizar Perfil: " + lookupError.message }
  }

  const resolvedTenant = existingRow?.org_id
    ? await fetchTenantById(supabase, existingRow.org_id)
    : await resolveAppTenantOrg(supabase)

  if (!resolvedTenant.org) {
    return { error: "Não foi possível resolver o tenant canônico do perfil." }
  }

  const tenantSource = "source" in resolvedTenant ? resolvedTenant.source : "existing_org_id"

  const currentPayload = (existingRow?.payload ?? {}) as Record<string, unknown>
  const currentTenantPayload = (currentPayload.tenant as Record<string, unknown> | undefined) || {}
  const leadSignals = extractLeadSignalsFromSavedResultPayload({
    ...currentPayload,
    user_email: email,
    user_name: name,
  });

  const { error } = await supabase
    .from("saved_results")
    .update({
      user_email: email,
      user_name: name,
      org_id: resolvedTenant.org.id,
      payload: {
        ...currentPayload,
        tenant: {
          ...currentTenantPayload,
          orgId: resolvedTenant.org.id,
          orgSlug: resolvedTenant.org.slug,
          branchName: resolvedTenant.org.branch_name || null,
          whatsappNumber: resolvedTenant.org.whatsapp_number || null,
          source: tenantSource,
        },
      },
    })
    .eq("id", dbResultId);

  if (error) {
    return { error: "Erro ao salvar Perfil: " + error.message }
  }

  await supabase.from("tenant_events").insert({
    org_id: resolvedTenant.org.id,
    actor_user_id: null,
    event_type: "app.saved_result_updated",
    event_source: "app",
    dedupe_key: `saved_result_updated:${resolvedTenant.org.id}:${dbResultId}:${email}`,
    payload: {
      saved_result_id: dbResultId,
      email,
      org_slug: resolvedTenant.org.slug,
      org_source: tenantSource,
    },
  });

  try {
    const { lead, created } = await findOrCreateLead(supabase, {
      orgId: resolvedTenant.org.id,
      name: leadSignals.name || name || null,
      email: leadSignals.email || email || null,
      phone: leadSignals.phone || null,
      source: "app",
      status: "new",
      savedResultId: dbResultId,
      intentScore: leadSignals.intentScore ?? null,
      whatsappKey: leadSignals.whatsappKey || null,
      lastInteractionAt: leadSignals.lastInteractionAt || undefined,
    });

    await supabase.from("tenant_events").insert({
      org_id: resolvedTenant.org.id,
      actor_user_id: null,
      event_type: created ? "lead.created_from_app" : "lead.updated_from_app",
      event_source: "app",
      dedupe_key: `lead_from_app:${resolvedTenant.org.id}:${lead.id}:${dbResultId}`,
      payload: {
        lead_id: lead.id,
        saved_result_id: dbResultId,
        org_slug: resolvedTenant.org.slug,
        created,
      },
    });

    await bumpTenantUsageDaily(supabase, resolvedTenant.org.id, {
      events_count: 1,
      leads: created ? 1 : 0,
    });
  } catch (leadError) {
    console.warn("[LEADS] failed to sync lead from saved result update", leadError);
    await bumpTenantUsageDaily(supabase, resolvedTenant.org.id, { events_count: 1 });
  }

  // Redireciona de volta com mensagem de sucesso apontando para a mesma hash
  redirect(`/result?id=${dbResultId}&saved=true`)
}
