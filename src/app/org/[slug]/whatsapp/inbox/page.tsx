"use client";

import React, { useState } from "react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { useWhatsApp } from "@/lib/whatsapp/WhatsAppContext";
import { Search, Send, BrainCircuit, ShieldCheck, AlertCircle, LayoutGrid, MessageSquare, Sparkles } from "lucide-react";
import { VenusButton } from "@/components/ui/VenusButton";
import { generateSmartReplies } from "@/lib/whatsapp/smart-replies";
import { SmartReplyAngle, SmartReplySuggestion } from "@/types/whatsapp";
import { trackWhatsAppEvent } from "@/lib/whatsapp/analytics";
import { fetchSmartReplyOrgRanking, sortSmartRepliesByOrgRanking, type SmartReplyOrgRanking } from "@/lib/whatsapp/smart-reply-ranking";
import { buildSalesCopilotPlan } from "@/lib/whatsapp/sales-copilot";
import { SalesCopilotPanel } from "@/components/whatsapp/SalesCopilotPanel";
import {
  buildLookComposerMessage,
  buildProductComposerMessage,
  fetchMerchantProducts,
  generateLookSuggestions,
  generateProductSuggestions,
  parseLookCommand,
  parseProductCommand,
  type MerchantProfileSignals,
  type SlashLookSuggestion,
  type SlashProductSuggestion,
  type SlashProduct,
} from "@/lib/whatsapp/product-slash";
import { useAuth } from "@/lib/auth/AuthContext";
import { useParams } from "next/navigation";

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const SMART_REPLY_ANGLE_ORDER: SmartReplyAngle[] = ["closing", "objection", "desire"];

const SMART_REPLY_ANGLE_LABELS: Record<SmartReplyAngle, string> = {
  closing: "Closing",
  objection: "Objection",
  desire: "Desire",
  price: "Price",
  fit: "Fit",
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

function InboxView() {
  const { user } = useAuth();
  const { conversations, activeConversation, setActiveConversation, sendMessage, stats, resolveConversation, setFollowUp, sendProductLink, sendBundlePush, loading } = useWhatsApp();
  const [inputText, setInputText] = useState("");
  const [appliedReply, setAppliedReply] = useState<SmartReplySuggestion | null>(null);
  const [smartReplyRanking, setSmartReplyRanking] = useState<SmartReplyOrgRanking | null>(null);
  const [merchantProducts, setMerchantProducts] = useState<SlashProduct[]>([]);
  const [productCatalogLoading, setProductCatalogLoading] = useState(false);
  const shownSignatureRef = React.useRef<string | null>(null);
  const appliedSignatureRef = React.useRef<string | null>(null);
  const params = useParams();
  const slug = params?.slug as string;
  const productCommand = parseProductCommand(inputText);
  const lookCommand = parseLookCommand(inputText);
  const activeSlashMode = productCommand.active ? "product" : lookCommand.active ? "look" : null;
  const slashQuery = productCommand.active ? productCommand.query : lookCommand.query;
  const merchantProfile: MerchantProfileSignals | null = activeConversation
    ? {
        styleIdentity: activeConversation.user.styleIdentity,
        intentScore: activeConversation.user.intentScore,
        tryOnCount: activeConversation.user.tryOnCount,
        viewedProducts: activeConversation.user.viewedProducts,
        orgSlug: activeConversation.orgSlug,
      }
    : null;

  const smartReplies = React.useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.status !== 'human_required' && activeConversation.status !== 'human_takeover') return [];
    return generateSmartReplies(activeConversation);
  }, [activeConversation]);

  React.useEffect(() => {
    if (!slug) {
      setSmartReplyRanking(null);
      return;
    }

    let cancelled = false;
    setSmartReplyRanking(null);

    fetchSmartReplyOrgRanking(slug)
      .then((ranking) => {
        if (!cancelled) {
          setSmartReplyRanking(ranking);
        }
      })
      .catch((error) => {
        console.warn("[WHATSAPP_RANKING] failed to load org ranking", error);
        if (!cancelled) {
          setSmartReplyRanking(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  React.useEffect(() => {
    if (!activeSlashMode || !user?.id) {
      setMerchantProducts([]);
      setProductCatalogLoading(false);
      return;
    }

    let cancelled = false;
    setProductCatalogLoading(true);

    fetchMerchantProducts(user.id)
      .then((products) => {
        if (!cancelled) {
          setMerchantProducts(products);
        }
      })
      .catch((error) => {
        console.warn("[WHATSAPP_PRODUCT_SLASH] failed to load catalog", error);
        if (!cancelled) {
          setMerchantProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProductCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlashMode, user?.id]);

  const rankedSmartReplies = React.useMemo(() => {
    return sortSmartRepliesByOrgRanking(smartReplies, smartReplyRanking);
  }, [smartReplies, smartReplyRanking]);

  const productSuggestions: SlashProductSuggestion[] =
    activeSlashMode === "product" && merchantProfile ? generateProductSuggestions(merchantProducts, merchantProfile, slashQuery) : [];
  const lookSuggestions: SlashLookSuggestion[] =
    activeSlashMode === "look" && merchantProfile ? generateLookSuggestions(merchantProducts, merchantProfile, slashQuery) : [];

  const operationalAngles = React.useMemo(() => {
    return SMART_REPLY_ANGLE_ORDER.map((angle) => {
      const performance = smartReplyRanking?.rankedAngles.find((item) => item.angle === angle);

      return {
        angle,
        label: SMART_REPLY_ANGLE_LABELS[angle],
        hasData: Boolean(performance),
        sentRate: performance?.sentRate ?? null,
        customerReplyRate: performance?.customerReplyRate ?? null,
        totalSent: performance?.totalSent ?? 0,
      };
    });
  }, [smartReplyRanking]);

  const topOperationalAngle = smartReplyRanking?.hasData ? smartReplyRanking.rankedAngles[0] ?? null : null;
  const salesCopilotPlan = React.useMemo(() => {
    if (!activeConversation) return null;

    return buildSalesCopilotPlan(activeConversation, rankedSmartReplies);
  }, [activeConversation, rankedSmartReplies]);

  const lastMessageId = activeConversation?.messages[activeConversation.messages.length - 1]?.id || null;

  // Track Shown Suggestions as one row per suggestion, deduped per conversation state.
  React.useEffect(() => {
    if (!activeConversation || !slug || rankedSmartReplies.length === 0) return;

    const baseSignature = `${slug}:${activeConversation.id}:${lastMessageId || 'none'}:${rankedSmartReplies.map(r => r.id).sort().join('|')}`;
    if (shownSignatureRef.current === baseSignature) return;
    shownSignatureRef.current = baseSignature;

    rankedSmartReplies.forEach((reply) => {
      trackWhatsAppEvent({
        org_slug: slug,
        conversation_id: activeConversation.id,
        event_type: 'smart_reply_shown',
        smart_reply: reply,
        dedupe_key: `${baseSignature}:${reply.id}:shown`,
        payload: { suggestion_count: rankedSmartReplies.length, suggestions: rankedSmartReplies.map(r => r.id) }
      });
    });
  }, [rankedSmartReplies, activeConversation, slug, lastMessageId]);

  React.useEffect(() => {
    if (!activeConversation || !slug || !appliedReply) return;

    const appliedSignature = `${slug}:${activeConversation.id}:${appliedReply.id}:applied`;
    if (appliedSignatureRef.current === appliedSignature) return;
    appliedSignatureRef.current = appliedSignature;

    trackWhatsAppEvent({
      org_slug: slug,
      conversation_id: activeConversation.id,
      event_type: 'smart_reply_applied',
      smart_reply: appliedReply,
      dedupe_key: appliedSignature
    });
  }, [appliedReply, activeConversation, slug, lastMessageId]);

  const applyReply = (reply: SmartReplySuggestion) => {
    if (!activeConversation || !slug) return;

    const clickedSignature = `${slug}:${activeConversation.id}:${lastMessageId || 'none'}:${reply.id}:clicked`;
    trackWhatsAppEvent({
      org_slug: slug,
      conversation_id: activeConversation.id,
      event_type: 'smart_reply_clicked',
      smart_reply: reply,
      dedupe_key: clickedSignature
    });

    setInputText(reply.text);
    setAppliedReply(reply);
  };

  const insertProductIntoComposer = (suggestion: SlashProductSuggestion) => {
    setInputText(buildProductComposerMessage(suggestion.product, { justification: suggestion.justification, reasonTags: suggestion.reasonTags }));
    setAppliedReply(null);
  };

  const insertLookIntoComposer = (look: SlashLookSuggestion) => {
    setInputText(buildLookComposerMessage(look));
    setAppliedReply(null);
  };

  if (loading && conversations.length === 0) {
     return (
        <div className="flex-1 flex items-center justify-center bg-black min-h-screen">
           <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
              <Text className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-bold">Arquitetando Conversas...</Text>
           </div>
        </div>
     );
  }

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversation || !slug) return;

    if (activeSlashMode === "product") {
      if (productSuggestions[0]) {
        insertProductIntoComposer(productSuggestions[0]);
      }
      return;
    }

    if (activeSlashMode === "look") {
      if (lookSuggestions[0]) {
        insertLookIntoComposer(lookSuggestions[0]);
      }
      return;
    }

    const conversationId = activeConversation.id;
    const conversationOrgSlug = slug;
    const appliedSnapshot = appliedReply;

    const metadata = appliedSnapshot ? {
       smart_reply_id: appliedSnapshot.id,
       smart_reply_angle: appliedSnapshot.angle
    } : {};

    const msgId = await sendMessage(inputText, 'merchant', 'text', metadata);
    
    if (appliedSnapshot && msgId) {
       trackWhatsAppEvent({
          org_slug: conversationOrgSlug,
          conversation_id: conversationId,
          message_id: msgId,
          event_type: 'smart_reply_sent',
          smart_reply: appliedSnapshot,
          dedupe_key: `sent:${msgId}`
       });
    }

    if (msgId) {
      setInputText("");
      setAppliedReply(null);
    }
  };

  const handleResolve = () => {
    if (activeConversation) resolveConversation(activeConversation.id);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-black text-white py-4 pr-10">
      
      {/* 1. LEFT PANEL: Conversations (Part 1) */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-white/5 pr-4 pl-10 overflow-y-auto no-scrollbar">
        <header className="py-4 space-y-4">
           <div className="flex items-center justify-between">
              <Heading as="h2" className="text-xl tracking-tight uppercase">Conversas</Heading>
              <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-white/40">
                 {stats.active} ATIVAS
              </div>
           </div>
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                className="w-full h-10 bg-white/5 rounded-xl pl-10 pr-4 text-xs text-white outline-none focus:ring-1 ring-[#D4AF37]/40 transition-all border border-white/5" 
              />
           </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-2">
           {conversations.map(conv => (
             <button 
               key={conv.id} 
               onClick={() => setActiveConversation(conv.id)}
               className={`w-full p-4 rounded-3xl transition-all text-left flex gap-4 group ${activeConversation?.id === conv.id ? "bg-[#D4AF37]/10 border border-[#D4AF37]/20" : "hover:bg-white/5 border border-transparent"}`}
             >
                <div className="flex-shrink-0 relative">
                   <div className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center text-lg font-serif ${activeConversation?.id === conv.id ? "bg-[#D4AF37] text-black" : "bg-white/5 text-white/40 group-hover:bg-white/10"}`}>
                      {conv.user.name.charAt(0)}
                   </div>
                   {conv.status === 'human_required' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black flex items-center justify-center animate-bounce">
                         <AlertCircle size={8} className="text-white" />
                      </div>
                   )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{conv.user.name}</span>
                      <span className="text-[8px] text-white/20 font-bold uppercase">{formatTime(conv.lastUpdated)}</span>
                   </div>
                   <p className={`text-[10px] truncate ${conv.status === 'human_required' ? "text-[#D4AF37] font-bold" : "text-white/40"}`}>
                      {conv.lastMessage}
                   </p>
                   <div className="flex gap-2 pt-1">
                      <div className={`px-1.5 py-0.5 rounded-sm text-[7px] font-bold uppercase tracking-widest ${conv.status === 'ai_active' ? "bg-blue-500/10 text-blue-400" : conv.status === 'human_required' ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-400"}`}>
                         {conv.status.replace('_', ' ')}
                      </div>
                      {conv.priority === 'high' && (
                        <div className="px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-400 text-[7px] font-bold uppercase tracking-widest">priority</div>
                      )}
                   </div>
                </div>
             </button>
           ))}
        </div>
      </div>

      {/* 2. CENTER PANEL: Chat (Part 1, 2, 6) */}
      <div className="flex-1 min-w-[500px] flex flex-col bg-white/[0.02] rounded-[48px] border border-white/5 mx-4 overflow-hidden">
        {activeConversation ? (
          <>
            <header className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-3xl">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] font-bold">{activeConversation.user.name.charAt(0)}</div>
                  <div className="flex flex-col">
                     <Heading as="h3" className="text-base tracking-tight">{activeConversation.user.name}</Heading>
                     <Text className="text-[10px] text-white/40 uppercase tracking-widest font-bold flex items-center gap-2">
                        {activeConversation.user.phone} · <span className="text-[#D4AF37]">{activeConversation.status.replace('_', ' ')}</span>
                     </Text>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={() => activeConversation && setFollowUp(activeConversation.id)}
                    className="px-4 py-2 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-white/40 italic"
                  >
                    Follow-up
                  </button>
                  <button 
                    onClick={handleResolve}
                    className="px-5 py-2 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                  >
                    Resolver
                  </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-8 scroll-smooth">
               {activeConversation.messages.map((msg) => (
                 <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? "items-start" : "items-end"}`}>
                    <div className="flex items-center gap-2 mb-2 px-2">
                       {msg.sender === 'ai' && <BrainCircuit size={10} className="text-[#D4AF37]" />}
                       {msg.sender === 'merchant' && <ShieldCheck size={10} className="text-green-500" />}
                       <span className={`text-[8px] uppercase font-bold tracking-[0.2em] ${msg.sender === 'user' ? "text-white/20" : msg.sender === 'ai' ? "text-[#D4AF37]" : "text-green-500"}`}>
                          {msg.sender === 'user' ? activeConversation.user.name : msg.sender === 'ai' ? "Venus AI" : "Merchant (Você)"}
                       </span>
                    </div>
                    <div className={`max-w-[80%] p-6 rounded-[32px] text-sm leading-relaxed ${msg.sender === 'user' ? "bg-white/5 text-white/90 rounded-bl-lg" : msg.sender === 'ai' ? "bg-[#D4AF37]/10 text-white/90 border border-[#D4AF37]/20 rounded-br-lg italic" : "bg-white text-black font-medium shadow-2xl rounded-br-lg"}`}>
                       {msg.text}
                    </div>
                    <span className="mt-2 text-[8px] text-white/10 uppercase font-bold px-2">
                       {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
               ))}
               <div className="h-px w-full invisible" id="msg-bottom" />
            </div>

            {/* Smart Replies Overlay */}
            {rankedSmartReplies.length > 0 && (
              <div className="px-8 py-4 bg-black/60 backdrop-blur-md border-t border-white/5 animate-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-3">
                   <Sparkles size={12} className="text-[#D4AF37]" />
                   <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-[#D4AF37]">Sugestões de Fechamento AI</span>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                   {rankedSmartReplies.map((reply) => (
                     <button
                       key={reply.id}
                       onClick={() => applyReply(reply)}
                       className="flex-shrink-0 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all flex flex-col items-start gap-2 max-w-[240px] group"
                     >
                        <div className="flex items-center gap-2">
                           <div className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest ${reply.angle === 'closing' ? "bg-green-500/10 text-green-400" : reply.angle === 'desire' ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
                              {reply.label}
                           </div>
                           {smartReplyRanking?.hasData && smartReplyRanking.bestAngle === reply.angle && (
                             <span className="px-1.5 py-0.5 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] text-[7px] font-bold uppercase tracking-widest">
                               Top da org
                             </span>
                           )}
                           <span className="text-[7px] text-white/20 font-bold uppercase group-hover:text-[#D4AF37]/50 transition-colors">{reply.recommendedFor}</span>
                        </div>
                        <p className="text-[10px] text-white/60 line-clamp-2 leading-relaxed text-left group-hover:text-white/90 transition-colors font-medium">
                           {reply.text}
                        </p>
                     </button>
                   ))}
                </div>
              </div>
            )}

            <footer className="p-8 border-t border-white/5 bg-black/40">
               <div className="relative group">
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();

                        if (activeSlashMode === "product") {
                          if (productSuggestions[0]) {
                            insertProductIntoComposer(productSuggestions[0]);
                          }
                          return;
                        }

                        if (activeSlashMode === "look") {
                          if (lookSuggestions[0]) {
                            insertLookIntoComposer(lookSuggestions[0]);
                          }
                          return;
                        }

                        handleSend();
                      }
                    }}
                    placeholder="Responda como Hunter Boutique..." 
                    className="w-full h-24 bg-white/5 rounded-3xl p-6 pr-20 text-sm text-white outline-none border border-white/5 focus:border-[#D4AF37]/40 transition-all resize-none placeholder:text-white/20" 
                  />
                  <div className="absolute right-4 bottom-4 flex items-center gap-2">
                     <button className="p-3 rounded-full hover:bg-white/5 text-white/40 transition-colors"><LayoutGrid size={16} /></button>
                     <button onClick={handleSend} className="p-3 bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-xl">
                        <Send size={18} />
                     </button>
                  </div>
               </div>

               {activeSlashMode && (
                  <div className="mt-4 rounded-[28px] border border-white/5 bg-black/70 backdrop-blur-md p-4 space-y-3">
                     <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                           <Text className="text-[9px] uppercase font-bold tracking-[0.3em] text-[#D4AF37]">{activeSlashMode === "product" ? "/produto" : "/look"}</Text>
                           <Text className="text-[9px] uppercase tracking-widest text-white/25">
                             {slashQuery
                               ? activeSlashMode === "product"
                                 ? `Buscando por "${slashQuery}"`
                                 : `Buscando por "${slashQuery}"`
                               : activeSlashMode === "product"
                                 ? "Digite o nome do produto"
                                 : "Digite estilo, categoria ou uma ideia de look"}
                           </Text>
                        </div>
                        <Text className="text-[8px] uppercase tracking-widest text-white/20">{merchantProducts.length} itens do catálogo</Text>
                     </div>

                     {productCatalogLoading ? (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3 text-[10px] text-white/40">
                           Carregando catálogo...
                        </div>
                     ) : activeSlashMode === "product" && productSuggestions.length > 0 ? (
                        <div className="space-y-2">
                           {productSuggestions.map((suggestion) => (
                             <button
                               key={suggestion.product.id}
                               type="button"
                               onClick={() => insertProductIntoComposer(suggestion)}
                               className="w-full text-left rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/20 transition-all"
                             >
                                <div className="flex items-start justify-between gap-3">
                                   <div className="min-w-0">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-white truncate">{suggestion.product.name}</div>
                                      <div className="mt-1 text-[8px] uppercase tracking-widest text-white/25 truncate">
                                        {suggestion.product.category}
                                        {suggestion.product.style ? ` • ${suggestion.product.style}` : ""}
                                        {suggestion.product.price_range ? ` • ${suggestion.product.price_range}` : ""}
                                      </div>
                                      <div className="mt-1 text-[8px] text-white/35 leading-relaxed line-clamp-2">
                                        {suggestion.reasonTags.join(" • ")}
                                      </div>
                                   </div>
                                   <span className="px-1.5 py-0.5 rounded border border-white/10 text-[7px] font-bold uppercase tracking-widest text-white/35">
                                     {Math.round(suggestion.confidence)}%
                                   </span>
                                </div>
                             </button>
                           ))}
                        </div>
                     ) : activeSlashMode === "look" && lookSuggestions.length > 0 ? (
                        <div className="space-y-2">
                           {lookSuggestions.map((look) => (
                             <button
                               key={look.id}
                               type="button"
                               onClick={() => insertLookIntoComposer(look)}
                               className="w-full text-left rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/20 transition-all"
                             >
                                <div className="flex items-start justify-between gap-3">
                                   <div className="min-w-0 space-y-1">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-white truncate">{look.title}</div>
                                      <div className="text-[8px] uppercase tracking-widest text-white/25 truncate">
                                        {look.items.map((item) => item.name).join(" • ")}
                                      </div>
                                      <div className="text-[8px] text-white/35 leading-relaxed line-clamp-2">
                                        {look.reasonTags.join(" • ")}
                                      </div>
                                   </div>
                                   <span className="px-1.5 py-0.5 rounded border border-white/10 text-[7px] font-bold uppercase tracking-widest text-white/35">
                                     Inserir
                                   </span>
                                </div>
                             </button>
                           ))}
                        </div>
                     ) : (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3 text-[10px] text-white/40">
                           {activeSlashMode === "product"
                             ? "Nenhum produto encontrado. O composer continua normal."
                             : "Nenhuma combinacao coerente encontrada. O composer continua normal."}
                        </div>
                     )}
                  </div>
               )}
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
             <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                <MessageSquare size={32} />
             </div>
             <div className="space-y-1">
                <Heading as="h3" className="text-xl uppercase tracking-widest">Selecione uma conversa</Heading>
                <Text className="text-xs uppercase tracking-widest">Sincronização em tempo real ativa</Text>
             </div>
          </div>
        )}
      </div>

      {/* 3. RIGHT PANEL: Context (Part 5, 8) */}
      <div className="w-80 flex-shrink-0 flex flex-col overflow-y-auto no-scrollbar space-y-8 pl-4">
        {activeConversation ? (
          <>
            {salesCopilotPlan && (
              <SalesCopilotPanel
                plan={salesCopilotPlan}
                onSendMessage={async (message) => {
                  await sendMessage(message, "merchant", "text", {
                    source: "sales_copilot",
                    stage: salesCopilotPlan.stage,
                    intent_score: salesCopilotPlan.stats.intentScore,
                  });
                }}
                onApplyMessage={(message) => setInputText(message)}
                onSendProductLink={async () => {
                  if (!activeConversation.user.viewedProducts[0]) return;
                  await sendProductLink("prod-id", activeConversation.user.viewedProducts[0]);
                }}
                onSendBundlePush={async () => {
                  const bundleLookName =
                    activeConversation.user.lookSummary?.[0]?.name ||
                    activeConversation.user.viewedProducts[0] ||
                    activeConversation.user.styleIdentity;
                  await sendBundlePush("look-id", bundleLookName);
                }}
                onSetFollowUp={async () => {
                  await setFollowUp(activeConversation.id);
                }}
              />
            )}

            <section className="space-y-4">
               <Heading as="h4" className="text-[10px] uppercase font-bold tracking-[0.24em] text-white/30 px-2">Respostas prontas</Heading>
               <div className="p-5 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                     <div className="space-y-1">
                        <Text className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Top angle atual</Text>
                        <Heading as="h5" className="text-base uppercase tracking-tight">
                          {topOperationalAngle ? SMART_REPLY_ANGLE_LABELS[topOperationalAngle.angle] : "Sem dados suficientes"}
                        </Heading>
                        <Text className="text-[9px] uppercase tracking-widest text-white/20">
                          {topOperationalAngle ? `Amostra: ${topOperationalAngle.totalSent} envios válidos` : "Aguardando volume mínimo para ranking"}
                        </Text>
                     </div>
                     <div className="text-right space-y-1">
                        <div className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Volume mínimo</div>
                        <div className="text-[12px] font-bold text-[#D4AF37]">3 envios</div>
                     </div>
                  </div>

                  {topOperationalAngle ? (
                    <div className="grid grid-cols-2 gap-3">
                       <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                          <Text className="text-[8px] uppercase tracking-widest text-white/30 font-bold">customer_reply_rate</Text>
                          <div className="mt-1 text-xl font-serif text-white">{formatPercent(topOperationalAngle.customerReplyRate)}</div>
                       </div>
                       <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                          <Text className="text-[8px] uppercase tracking-widest text-white/30 font-bold">sent_rate</Text>
                          <div className="mt-1 text-xl font-serif text-white">{formatPercent(topOperationalAngle.sentRate)}</div>
                       </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-black/20 border border-white/5 p-4">
                       <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Estado neutro</Text>
                       <p className="mt-2 text-[10px] text-white/45 leading-relaxed">
                         Ainda não existe volume suficiente para ranquear os ângulos desta org. O inbox segue com a ordem padrão.
                       </p>
                    </div>
                  )}

                  <div className="space-y-2">
                     {operationalAngles.map((item) => (
                       <div key={item.angle} className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 border border-white/5 px-3 py-2">
                          <div className="min-w-0">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white">{item.label}</span>
                                {topOperationalAngle?.angle === item.angle && (
                                  <span className="px-1.5 py-0.5 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] text-[7px] font-bold uppercase tracking-widest">
                                    Top
                                  </span>
                                )}
                             </div>
                             <div className="text-[8px] uppercase tracking-widest text-white/25 mt-1">
                                {item.hasData ? `${item.totalSent} envios válidos` : "Sem amostra suficiente"}
                             </div>
                          </div>
                          <div className="text-right text-[9px] uppercase tracking-widest text-white/35 font-bold">
                             <div>Reply {formatPercent(item.customerReplyRate)}</div>
                             <div>Send {formatPercent(item.sentRate)}</div>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </section>

            <section className="space-y-4">
               <Heading as="h4" className="text-[10px] uppercase font-bold tracking-[0.4em] text-white/30 px-2">Contexto de Decisão</Heading>
               <div className="p-6 rounded-[32px] bg-[#D4AF37]/5 border border-[#D4AF37]/10 space-y-6">
                  <div className="space-y-1">
                     <Text className="text-[8px] uppercase tracking-widest text-[#D4AF37] font-bold">Identidade Visual</Text>
                     <Heading as="h5" className="text-sm uppercase tracking-tight">{activeConversation.user.styleIdentity}</Heading>
                  </div>
                  <div className="flex items-center justify-between py-4 border-y border-white/5">
                     <div className="flex flex-col">
                        <span className="text-[14px] font-serif text-[#D4AF37]">{activeConversation.user.intentScore}%</span>
                        <span className="text-[8px] uppercase font-bold text-white/20">Intent Score</span>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[14px] font-serif text-white">{activeConversation.user.tryOnCount}</span>
                        <span className="text-[8px] uppercase font-bold text-white/20">Try-ons</span>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <Text className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Resumo AI</Text>
                     <p className="text-[10px] text-white/60 leading-relaxed italic">
                        &quot;Arthur está validando o blazer para eventos executivos. Já visualizou 2 vezes e usou o try-on 4 vezes. Tem dúvida sobre o material (Lã Fria).&quot;
                     </p>
                  </div>
               </div>
            </section>

            <section className="space-y-4">
               <div className="flex items-center justify-between px-2">
                  <Heading as="h4" className="text-[10px] uppercase font-bold tracking-[0.4em] text-white/30">Acervo do Interesse</Heading>
                  <Text className="text-[8px] uppercase font-bold text-[#D4AF37] underline">Ver todos</Text>
               </div>
               <div className="space-y-4">
                  {activeConversation.user.viewedProducts.map((p, i) => (
                    <div key={p} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-4 group">
                       <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden">
                          <img alt="" src={`https://images.unsplash.com/photo-${1594932224491 + i}-bb24dcafe277?q=80&w=100&auto=format`} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                       </div>
                       <div className="flex-1 overflow-hidden">
                          <Text className="text-[10px] font-bold uppercase truncate">{p}</Text>
                          <Text className="text-[9px] text-white/20 uppercase tracking-widest font-bold">R$ 1.250</Text>
                       </div>
                    </div>
                  ))}
               </div>
            </section>

            <section className="space-y-4 pt-10">
               <VenusButton 
                  onClick={() => activeConversation && sendProductLink("prod-id", activeConversation.user.viewedProducts[0])}
                  variant="outline" 
                  className="w-full py-6 h-auto text-[10px] font-bold uppercase tracking-[0.2em] border-white/10 text-white/40 hover:text-white transition-all bg-white/[0.01]"
               >
                  Gerar Link de Look
               </VenusButton>
               <VenusButton 
                  onClick={() => activeConversation && sendBundlePush("look-id", activeConversation.user.styleIdentity)}
                  variant="outline" 
                  className="w-full py-6 h-auto text-[10px] font-bold uppercase tracking-[0.2em] border-white/10 text-[#D4AF37] bg-[#D4AF37]/5"
               >
                  Push Bundle Especial
               </VenusButton>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function WhatsAppInboxPage() {
  return <InboxView />;
}
