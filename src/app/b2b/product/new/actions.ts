"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  type CurrentMerchantOrgContext,
  assertMerchantWritableOrgAccess,
  bumpTenantUsageDaily,
} from "@/lib/tenant/core"
import { enforceTenantOperationalState } from "@/lib/tenant/enforcement"
import { enforceOrgHardCap } from "@/lib/billing/enforcement"

const PRODUCT_BUCKET = "products"
const PRODUCT_FILE_LIMIT = 10 * 1024 * 1024

function normalizeString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : ""
}

function safeJsonArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [] as string[]

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return [] as string[]
    return parsed.map((item) => normalizeString(typeof item === "string" ? item : null)).filter(Boolean)
  } catch {
    return [] as string[]
  }
}

function safeVariantRows(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [] as Array<{ size: string; quantity: number; sku: string; active: boolean }>
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null

        const row = item as Record<string, unknown>
        const size = normalizeString(typeof row.size === "string" ? row.size : null)
        if (!size) return null

        const quantityRaw = row.quantity
        const quantity = Number.parseInt(typeof quantityRaw === "number" ? String(quantityRaw) : normalizeString(typeof quantityRaw === "string" ? quantityRaw : null) || "0", 10)
        const sku = normalizeString(typeof row.sku === "string" ? row.sku : null)

        return {
          size,
          quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
          sku,
          active: row.active !== false,
        }
      })
      .filter(Boolean) as Array<{ size: string; quantity: number; sku: string; active: boolean }>
  } catch {
    return []
  }
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  return cleaned || "image"
}

function appendQuery(pathname: string, query: string) {
  return pathname.includes("?") ? `${pathname}&${query}` : `${pathname}?${query}`
}

async function ensureProductsBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error } = await admin.storage.listBuckets()

  if (error) {
    throw error
  }

  const existing = buckets?.find((bucket) => bucket.name === PRODUCT_BUCKET)
  if (!existing) {
    const created = await admin.storage.createBucket(PRODUCT_BUCKET, {
      public: true,
      fileSizeLimit: PRODUCT_FILE_LIMIT,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    })

    if (created.error) {
      throw created.error
    }
    return
  }

  if (!existing.public) {
    const updated = await admin.storage.updateBucket(PRODUCT_BUCKET, {
      public: true,
      fileSizeLimit: PRODUCT_FILE_LIMIT,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    })

    if (updated.error) {
      throw updated.error
    }
  }
}

export async function createProduct(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/merchant")
  }

  const supabase = await createClient()
  let merchantOrg: CurrentMerchantOrgContext

  try {
    merchantOrg = await assertMerchantWritableOrgAccess(supabase)
  } catch {
    redirect("/merchant?error=tenant")
  }

  const { user, org } = merchantOrg
  const admin = createAdminClient()

  const operationalDecision = await enforceTenantOperationalState({
    orgId: org.id,
    operation: "catalog_product_creation",
    actorUserId: user.id,
    eventSource: "catalog",
    org,
    metadata: {
      user_id: user.id,
      org_slug: org.slug,
    },
  })

  if (!operationalDecision.allowed) {
    redirect(`/b2b/product/new?error=${encodeURIComponent(`tenant_blocked:${operationalDecision.reason || "tenant_not_found"}`)}`)
  }

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

  const name = normalizeString(formData.get("name"))
  const category = normalizeString(formData.get("category"))
  const primaryColor = normalizeString(formData.get("primary_color") || formData.get("dominant_color"))
  const style = normalizeString(formData.get("style"))
  const type = normalizeString(formData.get("type")) || category || "roupa"
  const priceRange = normalizeString(formData.get("price_range"))
  const externalUrl = normalizeString(formData.get("external_url"))
  const emotionalCopy = normalizeString(formData.get("emotional_copy")).slice(0, 300)
  const sizeType = normalizeString(formData.get("size_type")) || "clothing"
  const returnTo = normalizeString(formData.get("return_to")) || "/merchant"
  const tags = safeJsonArray(formData.get("tags_json") || formData.get("tags"))
  const variants = safeVariantRows(formData.get("variants_json"))
  const imageFile = formData.get("image_file")
  let imageUrl = normalizeString(formData.get("image_url"))

  if (imageFile instanceof File && imageFile.size > 0) {
    await ensureProductsBucket(admin)

    const fileName = sanitizeFileName(imageFile.name || "image")
    const storagePath = `${org.id}/${Date.now()}_${fileName}`
    const upload = await admin.storage.from(PRODUCT_BUCKET).upload(storagePath, Buffer.from(await imageFile.arrayBuffer()), {
      contentType: imageFile.type || "image/jpeg",
      upsert: false,
    })

    if (upload.error) {
      redirect(`/b2b/product/new?error=${encodeURIComponent(upload.error.message)}`)
    }

    const publicUrl = admin.storage.from(PRODUCT_BUCKET).getPublicUrl(storagePath).data.publicUrl
    if (publicUrl) {
      imageUrl = publicUrl
    }
  }

  const payload = {
    name,
    category,
    primary_color: primaryColor,
    style,
    type,
    price_range: priceRange,
    image_url: imageUrl,
    external_url: externalUrl,
    emotional_copy: emotionalCopy || null,
    tags: tags.length > 0 ? tags : null,
    size_type: sizeType,
    // Ponte temporária: b2b_user_id ainda ajuda compatibilidade durante a migração do catálogo legado.
    b2b_user_id: user.id,
    org_id: org.id,
  }

  const { data: inserted, error } = await admin
    .from("products")
    .insert([payload])
    .select("id, name, category, type")
    .single()

  if (error) {
    redirect("/b2b/product/new?error=" + encodeURIComponent(error.message))
  }

  if (inserted?.id && variants.length > 0) {
    const { error: variantsError } = await admin.from("product_variants").insert(
      variants.map((variant) => ({
        product_id: inserted.id,
        org_id: org.id,
        size: variant.size,
        quantity: variant.quantity,
        sku: variant.sku || null,
        active: variant.active,
      }))
    )

    if (variantsError) {
      console.error("[PRODUCT_VARIANTS] insert error:", variantsError)
    }
  }

  await admin.from("tenant_events").insert({
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
      size_type: sizeType,
      emotional_copy: emotionalCopy || null,
      tags,
    },
  })

  await bumpTenantUsageDaily(admin, org.id, { events_count: 1 })

  const revalidateTarget = returnTo.startsWith("/") ? returnTo.split("?")[0] : "/merchant"
  revalidatePath(revalidateTarget)
  if (revalidateTarget !== "/merchant") {
    revalidatePath("/merchant")
  }

  redirect(appendQuery(returnTo.startsWith("/") ? returnTo : "/merchant", "created=true"))
}
