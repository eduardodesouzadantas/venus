import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserMemory, OrgMemory, ConversationState } from "./conversation-engine-types";

export async function getUserMemory(userId: string, orgId: string): Promise<UserMemory | null> {
  const admin = createAdminClient();
  
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  const { data: conversationStats } = await admin
    .from("conversations")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("org_id", orgId);

  const { data: tryOnStats } = await admin
    .from("tryon_results")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId);

  const { data: conversions } = await admin
    .from("conversions")
    .select("id, converted_at")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .not("converted_at", "is", null);

  const { data: tags } = await admin
    .from("user_tags")
    .select("tag")
    .eq("user_id", userId)
    .eq("org_id", orgId);

  return {
    userId: profile.user_id,
    orgId: profile.org_id,
    styleIdentity: profile.style_identity || undefined,
    imageGoal: profile.image_goal || undefined,
    paletteFamily: profile.palette_family || undefined,
    fit: profile.fit_preference || undefined,
    metal: profile.metal_preference || undefined,
    preferredCategories: profile.preferred_categories || [],
    lastInteractionAt: profile.last_interaction_at || undefined,
    conversationCount: conversationStats?.length || 0,
    totalTryOns: tryOnStats?.length || 0,
    converted: (conversions?.length || 0) > 0,
    tags: tags?.map((t) => t.tag) || [],
  };
}

export async function getOrgMemory(userId: string, orgId: string): Promise<OrgMemory | null> {
  const admin = createAdminClient();
  
  const { data: purchases, error } = await admin
    .from("orders")
    .select("id, created_at, status")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !purchases?.length) {
    return {
      orgId,
      userId,
      isReturningCustomer: false,
      conversationHistory: [],
    };
  }

  const { data: conversationHistory } = await admin
    .from("conversation_states")
    .select("state, created_at, last_message")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    orgId,
    userId,
    isReturningCustomer: true,
    previousPurchases: purchases.map((p) => p.id),
    lastLookShown: undefined,
    conversationHistory: (conversationHistory || []).map((c) => ({
      state: c.state as ConversationState,
      at: c.created_at,
      messagePreview: c.last_message || "",
    })),
  };
}

export async function updateUserMemory(
  userId: string,
  orgId: string,
  updates: Partial<UserMemory>
): Promise<boolean> {
  const admin = createAdminClient();
  
  const { error } = await admin
    .from("user_profiles")
    .upsert({
      user_id: userId,
      org_id: orgId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,org_id" });

  return !error;
}

export async function addUserTag(userId: string, orgId: string, tag: string): Promise<boolean> {
  const admin = createAdminClient();
  
  const { error } = await admin
    .from("user_tags")
    .insert({
      user_id: userId,
      org_id: orgId,
      tag,
      created_at: new Date().toISOString(),
    });

  return !error;
}

export async function getUserTags(userId: string, orgId: string): Promise<string[]> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from("user_tags")
    .select("tag")
    .eq("user_id", userId)
    .eq("org_id", orgId);

  if (error || !data) {
    return [];
  }

  return data.map((t) => t.tag);
}

export async function saveConversationState(
  userId: string,
  orgId: string,
  conversationId: string,
  state: ConversationState,
  lastMessage: string
): Promise<boolean> {
  const admin = createAdminClient();
  
  const { error } = await admin
    .from("conversation_states")
    .insert({
      user_id: userId,
      org_id: orgId,
      conversation_id: conversationId,
      state,
      last_message: lastMessage.slice(0, 500),
      created_at: new Date().toISOString(),
    });

  if (error) {
    await admin
      .from("conversation_states")
      .update({
        state,
        last_message: lastMessage.slice(0, 500),
      })
      .eq("conversation_id", conversationId);
  }

  return true;
}

export async function getLastConversationState(
  userId: string,
  orgId: string
): Promise<ConversationState | null> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from("conversation_states")
    .select("state")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.state as ConversationState;
}

export function buildMemoryContext(memory: UserMemory | null): string[] {
  if (!memory) {
    return [];
  }

  const contextHints: string[] = [];

  if (memory.styleIdentity) {
    contextHints.push(`Perfil de estilo: ${memory.styleIdentity}`);
  }

  if (memory.imageGoal) {
    contextHints.push(`Objetivo de imagem: ${memory.imageGoal}`);
  }

  if (memory.paletteFamily) {
    contextHints.push(`Paleta preferida: ${memory.paletteFamily}`);
  }

  if (memory.fit) {
    contextHints.push(`Caimento preferido: ${memory.fit}`);
  }

  if (memory.conversationCount > 1) {
    contextHints.push(`Cliente recorrente (${memory.conversationCount} conversas)`);
  }

  if (memory.converted) {
    contextHints.push("Cliente convertido anteriormente");
  }

  if (memory.tags.length > 0) {
    contextHints.push(`Tags: ${memory.tags.join(", ")}`);
  }

  return contextHints;
}

export function shouldSkipOnboarding(memory: UserMemory | null): boolean {
  if (!memory) return false;
  
  return !!(memory.styleIdentity || memory.imageGoal || memory.conversationCount > 0);
}

export function getPersonalizationHints(memory: UserMemory | null, state: ConversationState): string[] {
  if (!memory) return [];
  
  const hints: string[] = [];
  
  if (state === "DISCOVERY" && memory.conversationCount > 0) {
    hints.push("Usuário já conversou antes - evitar repetição de onboarding");
    if (memory.styleIdentity) {
      hints.push(`Lembrar que o estilo é ${memory.styleIdentity}`);
    }
  }
  
  if (state === "STYLE_ANALYSIS" && memory.hasOwnProperty("styleIdentity")) {
    hints.push("Usuário já tem perfil definido - pular coleta básica");
  }
  
  if (memory.converted) {
    hints.push("Usuário convertido - experiência mais streamline");
  }
  
  return hints;
}