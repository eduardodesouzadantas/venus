import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeBaseEntry, KnowledgeBaseConfig, KnowledgeBaseSearchResult } from "./types";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getKnowledgeBaseConfig(orgId: string): Promise<KnowledgeBaseConfig | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  const { data, error } = await admin
    .from("tenant_knowledge_base_config")
    .select("*")
    .eq("org_id", normalizedOrgId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    org_id: data.org_id,
    enabled: data.enabled ?? false,
    embedding_model: data.embedding_model || undefined,
    similarity_threshold: data.similarity_threshold ?? 0.7,
    max_results: data.max_results ?? 5,
    auto_sync: data.auto_sync ?? false,
    last_indexed_at: data.last_indexed_at || null,
  };
}

export async function getOrCreateKnowledgeBaseConfig(orgId: string): Promise<KnowledgeBaseConfig> {
  let config = await getKnowledgeBaseConfig(orgId);

  if (!config) {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("tenant_knowledge_base_config")
      .insert({
        org_id: orgId,
        enabled: false,
        similarity_threshold: 0.7,
        max_results: 5,
        auto_sync: false,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create KB config: ${error?.message || "unknown"}`);
    }

    config = {
      org_id: data.org_id,
      enabled: data.enabled,
      embedding_model: data.embedding_model,
      similarity_threshold: data.similarity_threshold,
      max_results: data.max_results,
      auto_sync: data.auto_sync,
      last_indexed_at: data.last_indexed_at,
    };
  }

  return config;
}

export async function updateKnowledgeBaseConfig(
  orgId: string,
  updates: Partial<KnowledgeBaseConfig>
): Promise<KnowledgeBaseConfig | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  await getOrCreateKnowledgeBaseConfig(normalizedOrgId);

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled;
  }

  if (updates.embedding_model !== undefined) {
    updateData.embedding_model = updates.embedding_model || null;
  }

  if (updates.similarity_threshold !== undefined) {
    updateData.similarity_threshold = Math.max(0, Math.min(1, updates.similarity_threshold));
  }

  if (updates.max_results !== undefined) {
    updateData.max_results = Math.max(1, Math.min(20, updates.max_results));
  }

  if (updates.auto_sync !== undefined) {
    updateData.auto_sync = updates.auto_sync;
  }

  const { data, error } = await admin
    .from("tenant_knowledge_base_config")
    .update(updateData)
    .eq("org_id", normalizedOrgId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return {
    org_id: data.org_id,
    enabled: data.enabled,
    embedding_model: data.embedding_model,
    similarity_threshold: data.similarity_threshold,
    max_results: data.max_results,
    auto_sync: data.auto_sync,
    last_indexed_at: data.last_indexed_at,
  };
}

export async function getKnowledgeBaseEntries(
  orgId: string,
  category?: string,
  includeInactive: boolean = false
): Promise<KnowledgeBaseEntry[]> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return [];

  let query = admin
    .from("tenant_knowledge_base")
    .select("*")
    .eq("org_id", normalizedOrgId);

  if (category) {
    query = query.eq("category", category);
  }

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.warn("[TENANT_CONFIG] Failed to get KB entries", { orgId, error: error.message });
    return [];
  }

  return (data || []) as KnowledgeBaseEntry[];
}

export async function addKnowledgeBaseEntry(
  orgId: string,
  entry: {
    title: string;
    content: string;
    category: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<KnowledgeBaseEntry | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return null;

  if (!entry.title || !entry.content || !entry.category) {
    throw new Error("title, content, and category are required");
  }

  const { data, error } = await admin
    .from("tenant_knowledge_base")
    .insert({
      org_id: normalizedOrgId,
      title: normalizeString(entry.title),
      content: entry.content.slice(0, 10000),
      category: normalizeString(entry.category),
      tags: entry.tags || [],
      metadata: entry.metadata || {},
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.warn("[TENANT_CONFIG] Failed to add KB entry", { orgId, error: error.message });
    throw new Error(`Failed to add KB entry: ${error.message}`);
  }

  return data as KnowledgeBaseEntry;
}

export async function updateKnowledgeBaseEntry(
  orgId: string,
  entryId: string,
  updates: Partial<{
    title: string;
    content: string;
    category: string;
    tags: string[];
    metadata: Record<string, unknown>;
    is_active: boolean;
  }>
): Promise<KnowledgeBaseEntry | null> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  const normalizedEntryId = normalizeString(entryId);

  if (!normalizedOrgId || !normalizedEntryId) return null;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) updateData.title = normalizeString(updates.title);
  if (updates.content !== undefined) updateData.content = updates.content.slice(0, 10000);
  if (updates.category !== undefined) updateData.category = normalizeString(updates.category);
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data, error } = await admin
    .from("tenant_knowledge_base")
    .update(updateData)
    .eq("id", normalizedEntryId)
    .eq("org_id", normalizedOrgId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as KnowledgeBaseEntry;
}

export async function deleteKnowledgeBaseEntry(
  orgId: string,
  entryId: string
): Promise<boolean> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  const normalizedEntryId = normalizeString(entryId);

  if (!normalizedOrgId || !normalizedEntryId) return false;

  const { error } = await admin
    .from("tenant_knowledge_base")
    .delete()
    .eq("id", normalizedEntryId)
    .eq("org_id", normalizedOrgId);

  return !error;
}

export async function searchKnowledgeBase(
  orgId: string,
  query: string,
  options?: {
    category?: string;
    tags?: string[];
    max_results?: number;
    similarity_threshold?: number;
  }
): Promise<KnowledgeBaseSearchResult[]> {
  const config = await getKnowledgeBaseConfig(orgId);

  if (!config || !config.enabled) {
    return [];
  }

  const entries = await getKnowledgeBaseEntries(orgId, options?.category, false);

  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const results: KnowledgeBaseSearchResult[] = [];

  for (const entry of entries) {
    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const tagsLower = (entry.tags || []).map((t) => t.toLowerCase());

    let score = 0;

    for (const term of searchTerms) {
      if (titleLower.includes(term)) score += 0.5;
      if (tagsLower.some((t) => t.includes(term))) score += 0.3;
      if (contentLower.includes(term)) score += 0.2;
    }

    if (score > 0) {
      const highlights = searchTerms.filter(
        (term) => titleLower.includes(term) || contentLower.includes(term)
      );

      results.push({
        entry,
        similarity: score,
        highlights,
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);

  const maxResults = options?.max_results ?? config.max_results;
  const threshold = options?.similarity_threshold ?? config.similarity_threshold;

  return results
    .filter((r) => r.similarity >= threshold)
    .slice(0, maxResults);
}

export async function getKnowledgeBaseCategories(orgId: string): Promise<string[]> {
  const admin = createAdminClient();

  const normalizedOrgId = normalizeString(orgId);
  if (!normalizedOrgId) return [];

  const { data, error } = await admin
    .from("tenant_knowledge_base")
    .select("category")
    .eq("org_id", normalizedOrgId)
    .eq("is_active", true);

  if (error) {
    return [];
  }

  const categories = new Set<string>();
  for (const row of data || []) {
    if (row.category) categories.add(row.category);
  }

  return Array.from(categories).sort();
}

export async function reindexKnowledgeBase(orgId: string): Promise<{ success: boolean; entries_indexed: number; error?: string }> {
  const entries = await getKnowledgeBaseEntries(orgId, undefined, true);

  const admin = createAdminClient();

  await admin
    .from("tenant_knowledge_base_config")
    .update({
      last_indexed_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  return {
    success: true,
    entries_indexed: entries.length,
  };
}

export function buildKnowledgeBaseContext(
  searchResults: KnowledgeBaseSearchResult[]
): string {
  if (searchResults.length === 0) return "";

  const parts: string[] = ["BASE DE CONHECIMENTO DA MARCA:\n"];

  for (const result of searchResults) {
    parts.push(`--- ${result.entry.title} (${result.entry.category}) ---`);
    parts.push(result.entry.content);
    parts.push("");
  }

  return parts.join("\n");
}

export function adaptResponseWithKnowledge(
  response: string,
  searchResults: KnowledgeBaseSearchResult[]
): string {
  if (searchResults.length === 0) return response;

  const hasRelevantInfo = searchResults.some(
    (r) => r.entry.tags?.some((t) => ["marca", "brand", "empresa", "company", "política", "policy"].includes(t.toLowerCase()))
  );

  if (!hasRelevantInfo) return response;

  return response;
}