"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  PRODUCT_ALLOWED_IMAGE_MIME_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
  normalizeProductCategory,
  normalizeProductStyle,
  normalizeProductTags,
  validateProductImageFile,
} from "@/lib/catalog/product-enrichment"
import {
  deriveStockStatus,
  normalizeStockStatus,
  parseNonNegativeInteger,
} from "@/lib/catalog/stock"
import {
  type CurrentMerchantOrgContext,
  assertMerchantWritableOrgAccess,
  bumpTenantUsageDaily,
} from "@/lib/tenant/core"
import { enforceTenantOperationalState } from "@/lib/tenant/enforcement"
import { enforceOrgHardCap } from "@/lib/billing/enforcement"

const PRODUCT_BUCKET = "products"

const VALID_SIZE_TYPES = new Set(["clothing", "numeric", "shoes", "single"])

function normalizeString(value: FormDataEntryValue | null, maxLength = 120) {
  const raw = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  return raw.slice(0, maxLength)
}

function appendQuery(pathname: string, query: string) {
  return pathname.includes("?") ? `${pathname}&${query}` : `${pathname}?${query}`
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

function parseStringArray(value: FormDataEntryValue | null, maxItems = 12) {
  if (typeof value !== "string" || !value.trim()) return [] as string[]

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return normalizeProductTags(parsed, maxItems)
    }
  } catch {
    // Fall through to comma separated parsing.
  }

  return normalizeProductTags(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    maxItems
  )
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null
  }

  return parseNonNegativeInteger(value)
}

function parseVariantRows(value: FormDataEntryValue | null) {
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
        const size = normalizeString(typeof row.size === "string" ? row.size : null, 24)
        if (!size) return null

        const quantityRaw = row.quantity
        const quantity = Number.parseInt(
          typeof quantityRaw === "number" ? String(quantityRaw) : normalizeString(typeof quantityRaw === "string" ? quantityRaw : null, 12) || "0",
          10
        )
        const sku = normalizeString(typeof row.sku === "string" ? row.sku : null, 64)

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

function parseVariantTotal(value: FormDataEntryValue | null) {
  return parseVariantRows(value).reduce((total, row) => total + row.quantity, 0)
}

function parseStockFormData(formData: FormData) {
  const stockQtyValue = formData.get("stock_qty")
  const reservedQtyValue = formData.get("reserved_qty")
  const stockStatusValue = formData.get("stock_status")
  const stockQtyRaw = parseOptionalInteger(stockQtyValue)
  const reservedQtyRaw = parseOptionalInteger(reservedQtyValue)
  const variantFallback = parseVariantTotal(formData.get("variants_json"))
  const stockQtyProvided = typeof stockQtyValue === "string" && stockQtyValue.trim().length > 0
  const reservedQtyProvided = typeof reservedQtyValue === "string" && reservedQtyValue.trim().length > 0
  const stockStatusProvided = typeof stockStatusValue === "string" && stockStatusValue.trim().length > 0
  const stockStatusNormalized = normalizeStockStatus(stockStatusValue)

  if (stockQtyProvided && stockQtyRaw === null) {
    return { invalidReason: "stock_qty_invalid" as const, stockQty: 0, reservedQty: 0, stockStatus: "out_of_stock" as const, availableQty: 0 }
  }

  if (reservedQtyProvided && reservedQtyRaw === null) {
    return { invalidReason: "reserved_qty_invalid" as const, stockQty: 0, reservedQty: 0, stockStatus: "out_of_stock" as const, availableQty: 0 }
  }

  if (stockStatusProvided && !stockStatusNormalized) {
    return { invalidReason: "stock_status_invalid" as const, stockQty: 0, reservedQty: 0, stockStatus: "out_of_stock" as const, availableQty: 0 }
  }

  const stockQty = stockQtyRaw ?? variantFallback
  const reservedQty = reservedQtyRaw ?? 0
  const stockStatus = stockStatusNormalized ?? deriveStockStatus(stockQty, reservedQty)
  const availableQty = Math.max(stockQty - reservedQty, 0)

  return {
    invalidReason: null,
    stockQty,
    reservedQty,
    stockStatus,
    availableQty,
  }
}

function appendValidationError(pathname: string, reason: string) {
  redirect(appendQuery(pathname, `error=${encodeURIComponent(`validation:${reason}`)}`))
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
      fileSizeLimit: PRODUCT_IMAGE_MAX_BYTES,
      allowedMimeTypes: Array.from(PRODUCT_ALLOWED_IMAGE_MIME_TYPES),
    })

    if (created.error) {
      throw created.error
    }
    return
  }

  if (!existing.public) {
    const updated = await admin.storage.updateBucket(PRODUCT_BUCKET, {
      public: true,
      fileSizeLimit: PRODUCT_IMAGE_MAX_BYTES,
      allowedMimeTypes: Array.from(PRODUCT_ALLOWED_IMAGE_MIME_TYPES),
    })

    if (updated.error) {
      throw updated.error
    }
  }
}

export async function validateProductUpload(file: File | null | undefined) {
  return validateProductImageFile(file)
}

export async function updateProductStock(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/merchant")
  }

  const requestedReturnTo = normalizeString(formData.get("return_to"), 2048)
  const safeReturnTo = requestedReturnTo.startsWith("/") ? requestedReturnTo : "/merchant"

  const supabase = await createClient()
  let merchantOrg: CurrentMerchantOrgContext

  try {
    merchantOrg = await assertMerchantWritableOrgAccess(supabase)
  } catch {
    redirect(`${safeReturnTo}?error=tenant`)
  }

  const { user, org } = merchantOrg
  const admin = createAdminClient()
  const productId = normalizeString(formData.get("product_id"), 64)

  if (!productId) {
    appendValidationError(safeReturnTo, "product_required")
  }

  const { data: existingProduct, error: existingError } = await admin
    .from("products")
    .select("id, org_id")
    .eq("id", productId)
    .eq("org_id", org.id)
    .maybeSingle()

  if (existingError || !existingProduct) {
    redirect(`${safeReturnTo}?error=${encodeURIComponent("product_not_found")}`)
  }

  const stock = parseStockFormData(formData)
  if (stock.invalidReason) {
    appendValidationError(safeReturnTo, stock.invalidReason)
  }

  if (!Number.isFinite(stock.stockQty) || stock.stockQty < 0) {
    appendValidationError(safeReturnTo, "stock_qty_invalid")
  }

  if (!Number.isFinite(stock.reservedQty) || stock.reservedQty < 0) {
    appendValidationError(safeReturnTo, "reserved_qty_invalid")
  }

  const { error } = await admin
    .from("products")
    .update({
      stock_qty: stock.stockQty,
      reserved_qty: stock.reservedQty,
      stock_status: stock.stockStatus,
      stock: stock.availableQty,
    })
    .eq("id", productId)
    .eq("org_id", org.id)

  if (error) {
    redirect(`${safeReturnTo}?error=${encodeURIComponent(error.message)}`)
  }

  await admin.from("tenant_events").insert({
    org_id: org.id,
    actor_user_id: user.id,
    event_type: "catalog.stock_updated",
    event_source: "catalog",
    dedupe_key: `catalog.stock_updated:${org.id}:${productId}:${Date.now()}`,
    payload: {
      product_id: productId,
      org_id: org.id,
      stock_qty: stock.stockQty,
      reserved_qty: stock.reservedQty,
      stock_status: stock.stockStatus,
      available_qty: stock.availableQty,
    },
  })

  await bumpTenantUsageDaily(admin, org.id, { events_count: 1 })
  revalidatePath(safeReturnTo)
  if (safeReturnTo.startsWith("/org/")) {
    revalidatePath(safeReturnTo.replace(/\/catalog\/?$/, "/dashboard"))
  }
  redirect(appendQuery(safeReturnTo, "updated=true"))
}

export async function createProduct(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/merchant")
  }

  const requestedReturnTo = normalizeString(formData.get("return_to"), 2048)
  const safeReturnTo = requestedReturnTo.startsWith("/") ? requestedReturnTo : "/merchant"
  const errorPath = safeReturnTo.startsWith("/org/")
    ? `${safeReturnTo.replace(/\/$/, "")}/new`
    : "/b2b/product/new"

  const supabase = await createClient()
  let merchantOrg: CurrentMerchantOrgContext

  try {
    merchantOrg = await assertMerchantWritableOrgAccess(supabase)
  } catch {
    redirect(`${errorPath}?error=tenant`)
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
    redirect(`${errorPath}?error=${encodeURIComponent(`tenant_blocked:${operationalDecision.reason || "tenant_not_found"}`)}`)
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
    redirect(`${errorPath}?error=${encodeURIComponent(`hard_cap:${hardCapDecision.metric || "products"}`)}`)
  }

  const name = normalizeString(formData.get("name"), 120)
  const rawCategory = normalizeString(formData.get("category"), 32)
  const category = normalizeProductCategory(rawCategory || "roupa")
  const primaryColor = normalizeString(formData.get("primary_color") || formData.get("dominant_color"), 80)
  const style = normalizeProductStyle(normalizeString(formData.get("style"), 32))
  const type = rawCategory || category
  const priceRange = normalizeString(formData.get("price_range"), 64)
  const externalUrl = normalizeString(formData.get("external_url"), 2048)
  const description = normalizeString(formData.get("description"), 1200)
  const persuasiveDescription = normalizeString(formData.get("persuasive_description"), 1200)
  const emotionalCopy = normalizeString(formData.get("emotional_copy"), 300)
  const sizeType = VALID_SIZE_TYPES.has(normalizeString(formData.get("size_type"), 24)) ? normalizeString(formData.get("size_type"), 24) : "clothing"
  const tags = parseStringArray(formData.get("tags_json") || formData.get("tags"), 12)
  const variants = parseVariantRows(formData.get("variants_json"))
  const stock = parseStockFormData(formData)
  if (stock.invalidReason) {
    appendValidationError(errorPath, stock.invalidReason)
  }
  const imageFile = formData.get("image_file")
  const uploadCandidate = imageFile instanceof File ? imageFile : null
  const imageValidation = await validateProductUpload(uploadCandidate)
  const imageValidationReason = imageValidation.reason || "image_missing"
  let imageUrl = normalizeString(formData.get("image_url"), 2048)

  if (uploadCandidate && !imageValidation.valid) {
    appendValidationError(errorPath, imageValidationReason)
  }

  if (!name) {
    appendValidationError(errorPath, "name_required")
  }

  if (!primaryColor) {
    appendValidationError(errorPath, "primary_color_required")
  }

  if (!description) {
    appendValidationError(errorPath, "description_required")
  }

  if (!persuasiveDescription) {
    appendValidationError(errorPath, "persuasive_description_required")
  }

  if (!emotionalCopy) {
    appendValidationError(errorPath, "emotional_copy_required")
  }

  if (!Number.isFinite(stock.stockQty)) {
    appendValidationError(errorPath, "stock_qty_invalid")
  }

  if (!Number.isFinite(stock.reservedQty)) {
    appendValidationError(errorPath, "reserved_qty_invalid")
  }

  if (uploadCandidate && uploadCandidate.size > 0) {
    await ensureProductsBucket(admin)

    const fileName = sanitizeFileName(uploadCandidate.name || "image")
    const storagePath = `${org.id}/${Date.now()}_${fileName}`
    const upload = await admin.storage.from(PRODUCT_BUCKET).upload(storagePath, Buffer.from(await uploadCandidate.arrayBuffer()), {
      contentType: uploadCandidate.type || "image/jpeg",
      upsert: false,
    })

    if (upload.error) {
      redirect(`${errorPath}?error=${encodeURIComponent(upload.error.message)}`)
    }

    const publicUrl = admin.storage.from(PRODUCT_BUCKET).getPublicUrl(storagePath).data.publicUrl
    if (publicUrl) {
      imageUrl = publicUrl
    }
  }

  if (!imageUrl) {
    appendValidationError(errorPath, "image_required")
  }

  const payload = {
    name,
    category,
    primary_color: primaryColor,
    style,
    type,
    price_range: priceRange || null,
    image_url: imageUrl,
    external_url: externalUrl || null,
    stock_qty: stock.stockQty,
    reserved_qty: stock.reservedQty,
    stock_status: stock.stockStatus,
    stock: stock.availableQty,
    description: description || null,
    persuasive_description: persuasiveDescription || null,
    emotional_copy: emotionalCopy || null,
    tags: tags.length > 0 ? tags : null,
    size_type: sizeType,
    // Compatibilidade com o catalogo legado e com o tenant scoping atual.
    b2b_user_id: user.id,
    org_id: org.id,
  }

  const { data: inserted, error } = await admin
    .from("products")
    .insert([payload])
    .select("id, name, category, type")
    .single()

  if (error) {
    redirect(`${safeReturnTo}?error=` + encodeURIComponent(error.message))
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
      primary_color: primaryColor,
      style,
      description,
      persuasive_description: persuasiveDescription,
      emotional_copy: emotionalCopy,
      tags,
    },
  })

  await bumpTenantUsageDaily(admin, org.id, { events_count: 1 })

  const revalidateTarget = safeReturnTo.split("?")[0]
  revalidatePath(revalidateTarget)
  if (revalidateTarget !== "/merchant") {
    revalidatePath("/merchant")
  }
  if (safeReturnTo.startsWith("/org/")) {
    revalidatePath(safeReturnTo.replace(/\/catalog\/?$/, "/dashboard"))
  }

  redirect(appendQuery(safeReturnTo, "created=true"))
}
