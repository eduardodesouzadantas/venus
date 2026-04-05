"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  type CurrentMerchantOrgContext,
  assertMerchantWritableOrgAccess,
  bumpTenantUsageDaily,
} from "@/lib/tenant/core"
import { enforceOrgHardCap } from "@/lib/billing/enforcement"

export async function createProduct(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Modo local fake
    redirect("/merchant");
  }

  const supabase = await createClient()
  let merchantOrg: CurrentMerchantOrgContext
  try {
    merchantOrg = await assertMerchantWritableOrgAccess(supabase)
  } catch {
    redirect("/merchant?error=tenant");
  }

  const { user, org } = merchantOrg

  const hardCapDecision = await enforceOrgHardCap({
    orgId: org.id,
    operation: "catalog_product_creation",
    actorUserId: user.id,
    eventSource: "catalog",
    metadata: {
      user_id: user.id,
      org_slug: org.slug,
    },
  })

  if (!hardCapDecision.allowed) {
    redirect(`/b2b/product/new?error=${encodeURIComponent(`hard_cap:${hardCapDecision.metric || "products"}`)}`)
  }

  const payload = {
    name: formData.get("name"),
    category: formData.get("category"),
    primary_color: formData.get("primary_color"),
    style: formData.get("style"),
    type: formData.get("type"), // 'roupa' | 'acessorio'
    price_range: formData.get("price_range"),
    image_url: formData.get("image_url"),
    external_url: formData.get("external_url"),
    // Ponte temporária: b2b_user_id ainda ajuda compatibilidade durante a migração do catálogo legado.
    b2b_user_id: user.id,
    org_id: org.id,
  }

  const { data: inserted, error } = await supabase
    .from("products")
    .insert([payload])
    .select("id, name, category, type")
    .single()

  if (error) {
    redirect("/b2b/product/new?error=" + error.message)
  }

  await supabase.from("tenant_events").insert({
    org_id: org.id,
    actor_user_id: user.id,
    event_type: "catalog.product_created",
    event_source: "catalog",
    dedupe_key: `catalog.product_created:${org.id}:${inserted.id}`,
    payload: {
      product_id: inserted.id,
      org_id: org.id,
      name: inserted.name,
      category: inserted.category,
      type: inserted.type,
    },
  })

  await bumpTenantUsageDaily(supabase, org.id, { events_count: 1 })

  revalidatePath("/merchant")
  redirect("/merchant?created=true")
}
