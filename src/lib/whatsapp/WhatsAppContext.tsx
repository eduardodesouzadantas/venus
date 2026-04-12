"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { WhatsAppConversation, WhatsAppMessage, ConversationStatus, PriorityLevel } from "@/types/whatsapp";
import { usePathname } from "next/navigation";

import { trackWhatsAppEvent } from "@/lib/whatsapp/analytics";
import { createWhatsAppClient } from "@/lib/supabase/whatsapp-client";
import { hydrateWhatsAppConversationList } from "@/lib/whatsapp/context-bridge";

interface WhatsAppContextType {
  conversations: WhatsAppConversation[];
  activeConversation: WhatsAppConversation | null;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (text: string, sender?: string, type?: WhatsAppMessage['type'], metadata?: any) => Promise<string | undefined>;
  takeoverConversation: (id: string) => Promise<void>;
  resolveConversation: (id: string) => Promise<void>;
  setFollowUp: (id: string) => Promise<void>;
  sendProductLink: (id: string, name: string) => Promise<void>;
  sendBundlePush: (lookId: string, lookName: string) => Promise<void>;
  stats: any;
  loading: boolean;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export const WhatsAppProvider = ({ children }: { children: React.ReactNode }) => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = React.useMemo(() => {
    try {
      return createWhatsAppClient();
    } catch (error) {
      console.error("[WHATSAPP] Failed to initialize browser client", error);
      return null;
    }
  }, []);
  const pathname = usePathname();
  const currentOrgSlug = React.useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const orgIndex = parts.indexOf('org');
    return orgIndex >= 0 ? parts[orgIndex + 1] || null : null;
  }, [pathname]);

  // 1. Initial Data Fetch
  const fetchConversations = useCallback(async () => {
    if (!supabase) {
      setConversations([]);
      setActiveId(null);
      setLoading(false);
      return;
    }

    if (!currentOrgSlug) {
      setConversations([]);
      setActiveId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*, whatsapp_messages(*)')
      .eq('org_slug', currentOrgSlug)
      .order('last_updated', { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
    } else if (data) {
      // Map Supabase data to our type (nested messages)
      const mapped: WhatsAppConversation[] = data.map((conv: any) => ({
        id: conv.id,
        orgSlug: conv.org_slug,
        status: conv.status as ConversationStatus,
        priority: conv.priority as PriorityLevel,
        lastMessage: conv.last_message,
        lastUpdated: conv.last_updated,
        unreadCount: conv.unread_count,
        user: {
          name: conv.user_context?.name || "Cliente Venus",
          phone: conv.user_context?.phone || conv.user_phone || "",
          styleIdentity: conv.user_context?.styleIdentity || "",
          intentScore: conv.user_context?.intentScore || 0,
          viewedProducts: conv.user_context?.viewedProducts || [],
          lastLookId: conv.user_context?.lastLookId || "",
          tryOnCount: conv.user_context?.tryOnCount || 0,
          orgSlug: conv.user_context?.orgSlug || conv.org_slug,
          imageGoal: conv.user_context?.imageGoal || "",
          paletteFamily: conv.user_context?.paletteFamily || "",
          fit: conv.user_context?.fit || "",
          metal: conv.user_context?.metal || "",
          source: conv.user_context?.source || "manual",
          lastHandoffId: conv.user_context?.lastHandoffId || "",
          lookSummary: conv.user_context?.lookSummary || [],
        },
        messages: (conv.whatsapp_messages || []).map((m: any) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: m.created_at,
          type: m.type,
          orgSlug: m.org_slug,
          metadata: m.metadata
        })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      }));
      const hydrated = await hydrateWhatsAppConversationList(mapped);
      setConversations(hydrated);
    }
    setLoading(false);
  }, [supabase, currentOrgSlug]);

  useEffect(() => {
    if (!supabase) return;
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.realtime.setAuth().catch((error: unknown) => {
      console.warn("[WHATSAPP] Failed to sync tenant auth for realtime", error);
    });
  }, [supabase, currentOrgSlug]);

  useEffect(() => {
    if (!supabase) return;
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.startsWith("venus_whatsapp_tenant_session")) {
        void supabase.realtime.setAuth().catch((error: unknown) => {
          console.warn("[WHATSAPP] Failed to refresh tenant auth after storage change", error);
        });
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    if (typeof window === "undefined" || !currentOrgSlug) return;

    const refreshTenantAuth = () => {
      void supabase.realtime.setAuth().catch((error: unknown) => {
        console.warn("[WHATSAPP] Failed to refresh tenant auth", error);
      });
    };

    refreshTenantAuth();

    const intervalId = window.setInterval(refreshTenantAuth, 15 * 60 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshTenantAuth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [supabase, currentOrgSlug]);

  // 2. Real-time Subscriptions
  useEffect(() => {
    if (!supabase) return;
    if (!currentOrgSlug) return;

    const channel = supabase
      .channel(`inbox-${currentOrgSlug}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `org_slug=eq.${currentOrgSlug}` } as any,
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `org_slug=eq.${currentOrgSlug}` } as any,
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchConversations, currentOrgSlug]);

  const activeConversation = conversations.find(c => c.id === activeId && c.orgSlug === currentOrgSlug) || null;

  // 3. Automation & Scoring Logic (Migration from local-only)
  const calculateHandoffNeed = (conv: WhatsAppConversation) => {
    let score = 0;
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (!lastMsg) return { score: 0, required: false, priority: 'medium' as PriorityLevel };
    
    const text = lastMsg.text.toLowerCase();

    // Behavior weight
    if (conv.user.intentScore > 70) score += 40;
    if (conv.user.tryOnCount > 2) score += 20;

    // Linguistic triggers
    const highIntensity = ["comprar", "fechar", "preÃ§o", "pagar", "desconto", "agora", "quero"];
    const hesitation = ["dÃºvida", "inseguro", "nÃ£o sei", "tecido", "tamanho"];
    
    if (highIntensity.some(w => text.includes(w))) score += 50;
    if (hesitation.some(w => text.includes(w))) score += 30;

    return {
      score,
      required: score >= 60,
      priority: (score > 85 ? 'high' : 'medium') as PriorityLevel
    };
  };

  const sendMessage = async (text: string, userId: string = 'merchant', type: WhatsAppMessage['type'] = 'text', metadata?: any): Promise<string | undefined> => {
    if (!supabase) return;
    const targetId = activeId;
    if (!targetId || !currentOrgSlug) return;

    const conv = conversations.find(c => c.id === targetId && c.orgSlug === currentOrgSlug);
    if (!conv) return;

    if (userId !== "user") {
      const response = await fetch(`/api/org/${currentOrgSlug}/whatsapp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          to: conv.user.phone,
          text,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("Error sending Meta WhatsApp message:", payload?.error || response.statusText);
        return;
      }

      return payload?.message_id;
    }

    // 1. Insert message
    const { data: newMsg, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        org_slug: currentOrgSlug,
        conversation_id: targetId,
        sender: userId,
        text,
        type,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error sending message:", msgError);
      return;
    }

    // 2. Update conversation status/last message
    let newStatus = conv.status;
    let newPriority = conv.priority;

    if (userId === 'user') {
      // 1. Re-calculate handoff logic
      const tempMessages = [...conv.messages, { text } as any];
      const handoff = calculateHandoffNeed({ ...conv, messages: tempMessages });
      if (handoff.required) {
        newStatus = 'human_required';
        newPriority = handoff.priority;
      }

      // 2. Continuity Attribution Detection
      // Logic: Find the most recent 'smart_reply_sent' event for this conversation
      const { data: lastEvent } = await supabase
        .from('whatsapp_events')
        .select('*')
        .eq('org_slug', currentOrgSlug)
        .eq('conversation_id', targetId)
        .eq('event_type', 'smart_reply_sent')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastEvent) {
         if (lastEvent.message_id) {
            const sentAt = new Date(lastEvent.created_at).getTime();
            const replyAt = newMsg?.created_at ? new Date(newMsg.created_at).getTime() : Date.now();
            const gapMinutes = (replyAt - sentAt) / (1000 * 60);

            // Criteria: First reply after smart reply in a window of 2m to 24h
            if (gapMinutes >= 2 && gapMinutes <= 1440) {
               // Check if attribution already exists for this message_id to ensure idempotency
               const { data: exists } = await supabase
                  .from('whatsapp_events')
                  .select('id')
                  .eq('org_slug', currentOrgSlug)
                  .eq('event_type', 'customer_replied_after_smart_reply')
                  .eq('dedupe_key', `reply_after:${lastEvent.message_id}`)
                  .maybeSingle();

               if (!exists) {
                  await trackWhatsAppEvent({
                     org_slug: currentOrgSlug,
                     conversation_id: targetId,
                     message_id: lastEvent.message_id,
                     dedupe_key: `reply_after:${lastEvent.message_id}`,
                     event_type: 'customer_replied_after_smart_reply',
                     smart_reply: {
                        id: lastEvent.smart_reply_id,
                        angle: lastEvent.smart_reply_angle,
                        label: lastEvent.smart_reply_label
                     },
                     payload: { reply_delay_min: gapMinutes, reply_text_snippet: text.substring(0, 30) }
                  });
               }
            }
         }
      }
    } else if (userId === 'merchant') {
      newStatus = 'human_takeover';
    }

    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message: text,
        last_updated: new Date().toISOString(),
        status: newStatus,
        priority: newPriority,
        unread_count: userId === 'user' ? (conv.unreadCount + 1) : 0
      })
      .eq('id', targetId)
      .eq('org_slug', currentOrgSlug);

    return newMsg.id;
  };

  const takeoverConversation = async (id: string) => {
    if (!supabase) return;
    if (!currentOrgSlug) return;
    await supabase
      .from('whatsapp_conversations')
      .update({ status: 'human_takeover', priority: 'medium' })
      .eq('id', id)
      .eq('org_slug', currentOrgSlug);
  };

  const resolveConversation = async (id: string) => {
    if (!supabase) return;
    if (!currentOrgSlug) return;
    await supabase
      .from('whatsapp_conversations')
      .update({ status: 'resolved', priority: 'low' })
      .eq('id', id)
      .eq('org_slug', currentOrgSlug);
  };

  const setFollowUp = async (id: string) => {
    if (!supabase) return;
    if (!currentOrgSlug) return;
    await supabase
      .from('whatsapp_conversations')
      .update({ status: 'follow_up' })
      .eq('id', id)
      .eq('org_slug', currentOrgSlug);
  };

  const sendProductLink = async (productId: string, name: string) => {
    if (!supabase) return;
    await sendMessage(`Separei este item porque ele conversa com o seu perfil: ${name}. Se quiser, eu já te mostro a melhor forma de levar isso agora.`, 'merchant', 'product_link');
  };

  const sendBundlePush = async (lookId: string, lookName: string) => {
    if (!supabase) return;
    await sendMessage(`Preparei uma condição especial para você levar o estilo "${lookName}" completo. Posso deixar o próximo passo pronto agora?`, 'merchant', 'bundle_push');
  };

  const stats = {
    active: conversations.filter(c => c.status !== 'resolved').length,
    waiting: conversations.filter(c => c.status === 'human_required').length,
    takeovers: conversations.filter(c => c.status === 'human_takeover').length,
    conversionRate: 15.4
  };

  return (
    <WhatsAppContext.Provider value={{ 
      conversations, 
      activeConversation, 
      setActiveConversation: setActiveId,
      sendMessage,
      takeoverConversation,
      resolveConversation,
      setFollowUp,
      sendProductLink,
      sendBundlePush,
      stats,
      loading
    }}>
      {children}
    </WhatsAppContext.Provider>
  );
};

export const useWhatsApp = () => {
  const context = useContext(WhatsAppContext);
  if (!context) throw new Error("useWhatsApp must be used within WhatsAppProvider");
  return context;
};
