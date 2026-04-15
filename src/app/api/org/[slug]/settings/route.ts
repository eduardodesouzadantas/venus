import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import { getCatalogSources, addCatalogSource, updateCatalogSource } from "@/lib/tenant-config/catalog-sources";
import { updateTenantAIConfig } from "@/lib/tenant-config/ai-capabilities";
import { getTenantConfig } from "@/lib/tenant-config";
import {
  buildMerchantSettingsPayload,
  fileToDataUrl,
  normalizePrimaryColor,
  normalizeStoreName,
  normalizeWhatsAppNumber,
} from "@/lib/merchant/settings";
import type { CatalogSourceConfig, CatalogSourceStatus, CatalogSourceType, TenantAIConfig } from "@/lib/tenant-config/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isCatalogSourceType(value: unknown): value is CatalogSourceType {
  return value === "whatsapp" || value === "external_api" || value === "url" || value === "internal";
}

function normalizeCatalogSourceConfig(type: CatalogSourceType, config: Record<string, unknown>): CatalogSourceConfig {
  switch (type) {
    case "whatsapp":
      return {
        phone_number_id: typeof config.phone_number_id === "string" ? config.phone_number_id.trim() : "",
        business_account_id: typeof config.business_account_id === "string" ? config.business_account_id.trim() : "",
        catalog_id: typeof config.catalog_id === "string" ? config.catalog_id.trim() : "",
      };
    case "external_api":
      return {
        endpoint_url: typeof config.endpoint_url === "string" ? config.endpoint_url.trim() : "",
        auth_type:
          config.auth_type === "api_key" || config.auth_type === "oauth2" || config.auth_type === "bearer"
            ? config.auth_type
            : "none",
        auth_config: {},
      };
    case "internal":
      return {
        table_name: typeof config.table_name === "string" ? config.table_name.trim() : "",
      };
    case "url":
    default:
      return {
        feed_url: typeof config.feed_url === "string" ? config.feed_url.trim() : "",
        format: config.format === "xml" || config.format === "csv" ? config.format : "json",
      };
  }
}

function normalizeTenantAIConfig(value: unknown, fallback: TenantAIConfig) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const config = value as Record<string, unknown>;
  const capabilities = Array.isArray(config.capabilities)
    ? config.capabilities
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => {
          const capability = (item as Record<string, unknown>).capability;
          const enabled = (item as Record<string, unknown>).enabled;
          const limits = (item as Record<string, unknown>).limits;
          return {
            capability: typeof capability === "string" ? capability : "",
            enabled: typeof enabled === "boolean" ? enabled : false,
            limits: limits && typeof limits === "object" && !Array.isArray(limits) ? limits : undefined,
          };
        })
    : fallback.capabilities;

  return {
    ...fallback,
    capabilities: capabilities as TenantAIConfig["capabilities"],
    guided_mode_required: typeof config.guided_mode_required === "boolean" ? config.guided_mode_required : fallback.guided_mode_required,
    max_interaction_turns: typeof config.max_interaction_turns === "number" ? config.max_interaction_turns : fallback.max_interaction_turns,
    response_time_limit_ms: typeof config.response_time_limit_ms === "number" ? config.response_time_limit_ms : fallback.response_time_limit_ms,
    fallback_to_human_threshold:
      typeof config.fallback_to_human_threshold === "number" ? config.fallback_to_human_threshold : fallback.fallback_to_human_threshold,
    custom_instructions: typeof config.custom_instructions === "string" ? config.custom_instructions.slice(0, 5000) : fallback.custom_instructions,
    personality:
      config.personality === "friendly" || config.personality === "consultive" || config.personality === "direct" || config.personality === "professional"
        ? config.personality
        : fallback.personality,
    language_style: typeof config.language_style === "string" ? config.language_style.slice(0, 10) : fallback.language_style,
  };
}

async function readOrgOrThrow(slug: string) {
  const access = await resolveMerchantOrgAccess(slug);
  return access;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const access = await readOrgOrThrow(slug);
    const tenantConfig = await getTenantConfig(access.org.id);

    return NextResponse.json(
      {
        ok: true,
        org: {
          id: access.org.id,
          slug: access.org.slug,
          name: access.org.name,
          logo_url: access.org.logo_url || null,
          primary_color: access.org.primary_color || "#C9A84C",
          whatsapp_number: access.org.whatsapp_number || "",
          plan_id: access.org.plan_id || null,
          status: access.org.status,
        },
        tenant_config: tenantConfig,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load settings" },
      { status: 403 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await readOrgOrThrow(slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 403 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const currentName = access.org.name;
  const currentPrimaryColor = access.org.primary_color || "#C9A84C";
  const currentWhatsAppNumber = access.org.whatsapp_number || "";

  const nextName = normalize(formData.get("name")) || currentName;
  const nextPrimaryColor = normalizePrimaryColor(normalize(formData.get("primary_color")) || currentPrimaryColor);
  const nextWhatsAppNumber = normalizeWhatsAppNumber(normalize(formData.get("whatsapp_number")) || currentWhatsAppNumber);
  const clearLogo = normalize(formData.get("clear_logo")) === "1";
  const logoEntry = formData.get("logo_file");

  let logoUrl = access.org.logo_url || null;
  if (logoEntry instanceof File && logoEntry.size > 0) {
    logoUrl = await fileToDataUrl(logoEntry);
  } else if (clearLogo) {
    logoUrl = null;
  }

  const admin = createAdminClient();
  const payload = buildMerchantSettingsPayload({
    name: normalizeStoreName(nextName),
    logo_url: logoUrl,
    primary_color: nextPrimaryColor,
    whatsapp_number: nextWhatsAppNumber,
  });

  const { data, error } = await admin
    .from("orgs")
    .update({
      name: payload.name,
      logo_url: payload.logo_url,
      primary_color: payload.primary_color,
      whatsapp_number: payload.whatsapp_number,
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.org.id)
    .select("id, slug, name, logo_url, primary_color, whatsapp_number, plan_id, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to save settings" }, { status: 500 });
  }

  const catalogSourcesJson = normalize(formData.get("catalog_sources_json"));
  if (catalogSourcesJson) {
    const parsedSources = parseJson<Array<Record<string, unknown>>>(catalogSourcesJson, []);
    const existingSources = await getCatalogSources(access.org.id);
    const existingById = new Set(existingSources.map((source) => source.id));

    for (let index = 0; index < parsedSources.length; index++) {
      const entry = parsedSources[index];
      const type = isCatalogSourceType(entry.type) ? entry.type : "url";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!name) continue;

      const payloadSource = {
        type,
        name,
        config: normalizeCatalogSourceConfig(type, (entry.config as Record<string, unknown>) || {}),
        priority: typeof entry.priority === "number" ? entry.priority : index,
        is_default: typeof entry.is_default === "boolean" ? entry.is_default : false,
        status:
          entry.status === "inactive" || entry.status === "error" || entry.status === "syncing"
            ? (entry.status as CatalogSourceStatus)
            : "active",
      };

      if (typeof entry.id === "string" && existingById.has(entry.id)) {
        await updateCatalogSource(access.org.id, entry.id, payloadSource, access.user.id);
      } else {
        await addCatalogSource(access.org.id, payloadSource, access.user.id);
      }
    }
  }

  const aiConfigJson = normalize(formData.get("ai_config_json"));
  if (aiConfigJson) {
    const currentConfig = (await getTenantConfig(access.org.id))?.ai_config;
    if (currentConfig) {
      const normalizedAiConfig = normalizeTenantAIConfig(parseJson(aiConfigJson, {}), currentConfig);
      await updateTenantAIConfig(access.org.id, normalizedAiConfig);
    }
  }

  const tenantConfig = await getTenantConfig(access.org.id);

  return NextResponse.json(
    {
      ok: true,
      org: {
        id: data.id,
        slug: data.slug,
        name: data.name,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color || "#C9A84C",
        whatsapp_number: data.whatsapp_number || "",
        plan_id: data.plan_id || null,
        status: data.status,
      },
      tenant_config: tenantConfig,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
