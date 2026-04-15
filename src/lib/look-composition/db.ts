/**
 * Database operations for Look Compositions
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { LookComposition } from "./engine";

// Tipos locais para as tabelas
type LookCompositionRow = {
  id: string;
  org_id: string;
  result_id: string | null;
  lead_id: string | null;
  name: string;
  description: string | null;
  anchor_piece_id: string;
  support_piece_ids: string[];
  accessory_ids: string[];
  style_profile: string | null;
  occasion: string | null;
  confidence: number;
  total_price: number | null;
  tryon_image_url: string | null;
  tryon_status: string;
  tryon_generated_at: string | null;
  is_active: boolean;
  is_featured: boolean;
  view_count: number;
  tryon_count: number;
  conversion_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type LookCompositionInsert = Omit<LookCompositionRow, 'id' | 'created_at' | 'updated_at'>;

export interface SavedLookComposition extends LookComposition {
  dbId: string;
  org_id: string;
  tryonImageUrl?: string;
  tryonStatus: "pending" | "processing" | "completed" | "failed";
  viewCount: number;
  tryonCount: number;
  conversionCount: number;
  createdAt: string;
}

export async function saveLookComposition(
  composition: LookComposition,
  params: {
    orgId: string;
    resultId?: string;
    leadId?: string;
  }
): Promise<SavedLookComposition> {
  const admin = createAdminClient();

  const insertData = {
    org_id: params.orgId,
    result_id: params.resultId || null,
    lead_id: params.leadId || null,
    name: composition.name,
    description: composition.description,
    anchor_piece_id: composition.anchorPiece.id,
    support_piece_ids: composition.supportPieces.map((p) => p.id),
    accessory_ids: composition.accessories.map((p) => p.id),
    style_profile: composition.styleProfile,
    occasion: composition.occasion,
    confidence: composition.confidence,
    total_price: composition.totalPrice,
    is_active: true,
    is_featured: false,
    tryon_image_url: null,
    tryon_status: 'pending',
    tryon_generated_at: null,
    view_count: 0,
    tryon_count: 0,
    conversion_count: 0,
    metadata: {
      anchor_piece: composition.anchorPiece,
      support_pieces: composition.supportPieces,
      accessories: composition.accessories,
    },
  };

  const { data, error } = await admin
    .from("look_compositions")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("[saveLookComposition] Error:", error);
    throw error;
  }

  return mapRowToSavedComposition(data);
}

export async function getLookCompositionById(id: string): Promise<SavedLookComposition> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("look_compositions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[getLookCompositionById] Error:", error);
    throw error;
  }

  return mapRowToSavedComposition(data);
}

export async function getLookCompositionsByResult(
  resultId: string
): Promise<SavedLookComposition[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("look_compositions")
    .select("*")
    .eq("result_id", resultId)
    .eq("is_active", true)
    .order("confidence", { ascending: false });

  if (error) {
    console.error("[getLookCompositionsByResult] Error:", error);
    throw error;
  }

  return (data || []).map(mapRowToSavedComposition);
}

export async function getLookCompositionsByOrg(
  orgId: string,
  options?: {
    limit?: number;
    featured?: boolean;
  }
): Promise<SavedLookComposition[]> {
  const admin = createAdminClient();

  let query = admin
    .from("look_compositions")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (options?.featured) {
    query = query.eq("is_featured", true);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order("confidence", { ascending: false });

  if (error) {
    console.error("[getLookCompositionsByOrg] Error:", error);
    throw error;
  }

  return (data || []).map(mapRowToSavedComposition);
}

export async function updateLookCompositionTryOn(
  lookId: string,
  tryOnData: {
    imageUrl?: string;
    status: "pending" | "processing" | "completed" | "failed";
  }
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("look_compositions")
    .update({
      tryon_image_url: tryOnData.imageUrl,
      tryon_status: tryOnData.status,
      tryon_generated_at:
        tryOnData.status === "completed" ? new Date().toISOString() : undefined,
    })
    .eq("id", lookId);

  if (error) {
    console.error("[updateLookCompositionTryOn] Error:", error);
    throw error;
  }
}

export async function trackLookCompositionInteraction(
  lookId: string,
  interaction: {
    type: "view" | "tryon_click" | "tryon_generate" | "whatsapp_click" | "purchase_intent";
    leadId?: string;
    sessionId?: string;
    sourcePage?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const admin = createAdminClient();

  // Inserir interação
  const { error: insertError } = await admin
    .from("look_composition_interactions")
    .insert({
      look_composition_id: lookId,
      lead_id: interaction.leadId,
      session_id: interaction.sessionId,
      interaction_type: interaction.type,
      source_page: interaction.sourcePage,
      metadata: interaction.metadata || {},
    });

  if (insertError) {
    console.error("[trackLookCompositionInteraction] Error:", insertError);
    return; // Não throw para não quebrar fluxo
  }

  // Incrementar contador correspondente
  let counterName: string | null = null;
  switch (interaction.type) {
    case "view":
      counterName = "view";
      break;
    case "tryon_generate":
      counterName = "tryon";
      break;
  }

  if (counterName) {
    await admin.rpc("increment_look_composition_counter", {
      look_id: lookId,
      counter_name: counterName,
    });
  }
}

export async function recordLookCompositionConversion(
  lookId: string,
  conversion: {
    leadId?: string;
    purchasedProductIds: string[];
    totalValue?: number;
    source?: string;
    whatsappConversationId?: string;
  }
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("look_composition_conversions").insert({
    look_composition_id: lookId,
    lead_id: conversion.leadId,
    purchased_product_ids: conversion.purchasedProductIds,
    total_value: conversion.totalValue,
    source: conversion.source || "whatsapp",
    whatsapp_conversation_id: conversion.whatsappConversationId,
  });

  if (error) {
    console.error("[recordLookCompositionConversion] Error:", error);
    throw error;
  }

  // Incrementar contador de conversão
  await admin.rpc("increment_look_composition_counter", {
    look_id: lookId,
    counter_name: "conversion",
  });
}

function mapRowToSavedComposition(row: LookCompositionRow): SavedLookComposition {
  const metadata = (row.metadata as Record<string, unknown>) || {};

  return {
    dbId: row.id,
    id: row.id, // Usar dbId como id público também
    org_id: row.org_id,
    name: row.name,
    description: row.description || "",
    anchorPiece:
      (metadata.anchor_piece as LookComposition["anchorPiece"]) ||
      ({} as LookComposition["anchorPiece"]),
    supportPieces:
      (metadata.support_pieces as LookComposition["supportPieces"]) || [],
    accessories: (metadata.accessories as LookComposition["accessories"]) || [],
    totalPrice: row.total_price || 0,
    styleProfile: row.style_profile || "",
    occasion: row.occasion || "",
    confidence: row.confidence || 0,
    tryonImageUrl: row.tryon_image_url || undefined,
    tryonStatus: (row.tryon_status as SavedLookComposition["tryonStatus"]) || "pending",
    viewCount: row.view_count || 0,
    tryonCount: row.tryon_count || 0,
    conversionCount: row.conversion_count || 0,
    createdAt: row.created_at,
  };
}

// Função para buscar estatísticas de looks por org
export async function getLookCompositionStats(orgId: string): Promise<{
  totalLooks: number;
  totalViews: number;
  totalTryOns: number;
  totalConversions: number;
  conversionRate: number;
  topLooks: SavedLookComposition[];
}> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("look_compositions")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    console.error("[getLookCompositionStats] Error:", error);
    throw error;
  }

  const looks = (data || []).map(mapRowToSavedComposition);

  const totalViews = looks.reduce((sum, l) => sum + l.viewCount, 0);
  const totalTryOns = looks.reduce((sum, l) => sum + l.tryonCount, 0);
  const totalConversions = looks.reduce((sum, l) => sum + l.conversionCount, 0);

  return {
    totalLooks: looks.length,
    totalViews,
    totalTryOns,
    totalConversions,
    conversionRate: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0,
    topLooks: looks
      .sort((a, b) => b.conversionCount - a.conversionCount)
      .slice(0, 5),
  };
}
