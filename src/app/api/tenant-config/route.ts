import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateGuard } from "@/lib/tenant/guards";
import {
  getTenantConfig,
  updateTenantConfig,
  getTenantConfigSummary,
  validateTenantConfig,
  getSafeFallbackConfig,
  CatalogSources,
  AICapabilities,
  KnowledgeBase,
} from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function isAgencyOrOwner(request: Request, orgId: string) {
  if (!orgId) return false;
  
  const supabase = createAdminClient();
  const guardResult = await validateGuard(supabase, {
    requireAuthenticated: true,
    requireOrgId: orgId,
    requireAgency: true,
  });
  
  return guardResult.allowed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("org_id");
  const summary = url.searchParams.get("summary") === "true";
  const validate = url.searchParams.get("validate") === "true";
  const catalogSources = url.searchParams.get("catalog_sources") === "true";
  const aiConfig = url.searchParams.get("ai_config") === "true";
  const knowledgeBase = url.searchParams.get("knowledge_base") === "true";

  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const hasAccess = await isAgencyOrOwner(request, orgId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (summary) {
      const result = await getTenantConfigSummary(orgId);
      return NextResponse.json(result);
    }

    if (validate) {
      const result = await validateTenantConfig(orgId);
      return NextResponse.json(result);
    }

    if (catalogSources) {
      const sources = await CatalogSources.getCatalogSources(orgId);
      return NextResponse.json({ sources });
    }

    if (aiConfig) {
      const config = await AICapabilities.getTenantAIConfig(orgId);
      return NextResponse.json(config);
    }

    if (knowledgeBase) {
      const config = await KnowledgeBase.getKnowledgeBaseConfig(orgId);
      const entries = await KnowledgeBase.getKnowledgeBaseEntries(orgId);
      return NextResponse.json({ config, entries });
    }

    const config = await getTenantConfig(orgId);
    if (!config) {
      return NextResponse.json(getSafeFallbackConfig(orgId));
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[TENANT_CONFIG_API] GET failed", { orgId, error });
    return NextResponse.json(
      { error: "Failed to get config", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { org_id, action, data } = body;

    if (!org_id) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const hasAccess = await isAgencyOrOwner(request, org_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    switch (action) {
      case "update": {
        const result = await updateTenantConfig(org_id, data);
        return NextResponse.json(result);
      }

      case "validate": {
        const result = await validateTenantConfig(org_id);
        return NextResponse.json(result);
      }

      case "add_catalog_source": {
        const result = await CatalogSources.addCatalogSource(org_id, data);
        return NextResponse.json(result);
      }

      case "update_catalog_source": {
        const result = await CatalogSources.updateCatalogSource(org_id, data.id, data);
        return NextResponse.json(result);
      }

      case "delete_catalog_source": {
        const result = await CatalogSources.deleteCatalogSource(org_id, data.id);
        return NextResponse.json({ success: result });
      }

      case "sync_catalog_source": {
        const result = await CatalogSources.syncCatalogSource(org_id, data.id);
        return NextResponse.json(result);
      }

      case "update_ai_config": {
        const result = await AICapabilities.updateTenantAIConfig(org_id, data);
        return NextResponse.json(result);
      }

      case "check_capability": {
        const enabled = await AICapabilities.isCapabilityEnabled(org_id, data.capability);
        return NextResponse.json({ enabled });
      }

      case "check_capability_usage": {
        const result = await AICapabilities.checkAndUpdateCapabilityUsage(org_id, data.capability);
        return NextResponse.json(result);
      }

      case "update_knowledge_base_config": {
        const result = await KnowledgeBase.updateKnowledgeBaseConfig(org_id, data);
        return NextResponse.json(result);
      }

      case "add_knowledge_base_entry": {
        const result = await KnowledgeBase.addKnowledgeBaseEntry(org_id, data);
        return NextResponse.json(result);
      }

      case "search_knowledge_base": {
        const results = await KnowledgeBase.searchKnowledgeBase(org_id, data.query, data.options);
        return NextResponse.json({ results });
      }

      case "reindex_knowledge_base": {
        const result = await KnowledgeBase.reindexKnowledgeBase(org_id);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[TENANT_CONFIG_API] POST failed", { error });
    return NextResponse.json(
      { error: "Action failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}