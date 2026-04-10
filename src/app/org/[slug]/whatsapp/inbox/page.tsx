"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Text } from "@/components/ui/Text";
import { useWhatsApp } from "@/lib/whatsapp/WhatsAppContext";
import { generateSmartReplies } from "@/lib/whatsapp/smart-replies";
import { trackWhatsAppEvent } from "@/lib/whatsapp/analytics";
import {
  fetchSmartReplyOrgRanking,
  sortSmartRepliesByOrgRanking,
  type SmartReplyOrgRanking,
} from "@/lib/whatsapp/smart-reply-ranking";
import { buildSalesCopilotPlan } from "@/lib/whatsapp/sales-copilot";
import type { SmartReplySuggestion } from "@/types/whatsapp";
import { InboxConversationList } from "@/components/whatsapp/inbox/InboxConversationList";
import { InboxChatPanel } from "@/components/whatsapp/inbox/InboxChatPanel";
import { InboxIntelPanel } from "@/components/whatsapp/inbox/InboxIntelPanel";
import { toTitleCase } from "@/components/whatsapp/inbox/inbox-utils";

function WhatsAppInboxPageShell() {
  const params = useParams();
  const slug = params?.slug as string;
  const storeName = slug ? toTitleCase(slug) : "VENUS";

  const {
    conversations,
    activeConversation,
    setActiveConversation,
    sendMessage,
    stats,
    resolveConversation,
    setFollowUp,
    sendProductLink,
    sendBundlePush,
    loading,
  } = useWhatsApp();

  const [inputText, setInputText] = useState("");
  const [appliedReply, setAppliedReply] = useState<SmartReplySuggestion | null>(null);
  const [smartReplyRanking, setSmartReplyRanking] = useState<SmartReplyOrgRanking | null>(null);
  const [search, setSearch] = useState("");
  const shownSignatureRef = useRef<string | null>(null);
  const appliedSignatureRef = useRef<string | null>(null);

  const smartReplies = useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.status !== "human_required" && activeConversation.status !== "human_takeover") return [];
    return generateSmartReplies(activeConversation);
  }, [activeConversation]);

  useEffect(() => {
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

  const rankedSmartReplies = useMemo(
    () => sortSmartRepliesByOrgRanking(smartReplies, smartReplyRanking),
    [smartReplies, smartReplyRanking]
  );

  const topReply = rankedSmartReplies[0] ?? smartReplies[0] ?? null;

  const salesCopilotPlan = useMemo(() => {
    if (!activeConversation) return null;
    return buildSalesCopilotPlan(activeConversation, rankedSmartReplies);
  }, [activeConversation, rankedSmartReplies]);

  const activeCount = stats.active;

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      return (
        conversation.user.name.toLowerCase().includes(query) ||
        conversation.lastMessage.toLowerCase().includes(query) ||
        conversation.user.phone.toLowerCase().includes(query)
      );
    });
  }, [conversations, search]);

  useEffect(() => {
    if (!activeConversation || !slug || rankedSmartReplies.length === 0) return;

    const lastMessageId = activeConversation.messages[activeConversation.messages.length - 1]?.id || "none";
    const baseSignature = `${slug}:${activeConversation.id}:${lastMessageId}:${rankedSmartReplies.map((reply) => reply.id).sort().join("|")}`;
    if (shownSignatureRef.current === baseSignature) return;
    shownSignatureRef.current = baseSignature;

    rankedSmartReplies.forEach((reply) => {
      trackWhatsAppEvent({
        org_slug: slug,
        conversation_id: activeConversation.id,
        event_type: "smart_reply_shown",
        smart_reply: reply,
        dedupe_key: `${baseSignature}:${reply.id}:shown`,
        payload: {
          suggestion_count: rankedSmartReplies.length,
          suggestions: rankedSmartReplies.map((item) => item.id),
        },
      });
    });
  }, [activeConversation, rankedSmartReplies, slug]);

  useEffect(() => {
    if (!activeConversation || !slug || !appliedReply) return;

    const appliedSignature = `${slug}:${activeConversation.id}:${appliedReply.id}:applied`;
    if (appliedSignatureRef.current === appliedSignature) return;
    appliedSignatureRef.current = appliedSignature;

    trackWhatsAppEvent({
      org_slug: slug,
      conversation_id: activeConversation.id,
      event_type: "smart_reply_applied",
      smart_reply: appliedReply,
      dedupe_key: appliedSignature,
    });
  }, [activeConversation, appliedReply, slug]);

  const applyReply = (reply: SmartReplySuggestion) => {
    if (!activeConversation || !slug) return;

    const lastMessageId = activeConversation.messages[activeConversation.messages.length - 1]?.id || "none";
    const clickedSignature = `${slug}:${activeConversation.id}:${lastMessageId}:${reply.id}:clicked`;

    trackWhatsAppEvent({
      org_slug: slug,
      conversation_id: activeConversation.id,
      event_type: "smart_reply_clicked",
      smart_reply: reply,
      dedupe_key: clickedSignature,
    });

    setInputText(reply.text);
    setAppliedReply(reply);
  };

  const sendReply = async (reply: SmartReplySuggestion) => {
    if (!activeConversation || !slug) return;

    const lastMessageId = activeConversation.messages[activeConversation.messages.length - 1]?.id || "none";
    const clickedSignature = `${slug}:${activeConversation.id}:${lastMessageId}:${reply.id}:clicked`;

    trackWhatsAppEvent({
      org_slug: slug,
      conversation_id: activeConversation.id,
      event_type: "smart_reply_clicked",
      smart_reply: reply,
      dedupe_key: clickedSignature,
    });

    const messageId = await sendMessage(reply.text, "merchant");
    if (messageId) {
      trackWhatsAppEvent({
        org_slug: slug,
        conversation_id: activeConversation.id,
        message_id: messageId,
        event_type: "smart_reply_sent",
        smart_reply: reply,
        dedupe_key: `sent:${messageId}`,
      });
      setInputText("");
      setAppliedReply(null);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeConversation || !slug) return;

    const conversationId = activeConversation.id;
    const conversationOrgSlug = slug;
    const appliedSnapshot = appliedReply;

    const metadata = appliedSnapshot
      ? {
          smart_reply_id: appliedSnapshot.id,
          smart_reply_angle: appliedSnapshot.angle,
        }
      : {};

    const messageId = await sendMessage(inputText, "merchant", "text", metadata);

    if (appliedSnapshot && messageId) {
      trackWhatsAppEvent({
        org_slug: conversationOrgSlug,
        conversation_id: conversationId,
        message_id: messageId,
        event_type: "smart_reply_sent",
        smart_reply: appliedSnapshot,
        dedupe_key: `sent:${messageId}`,
      });
    }

    if (messageId) {
      setInputText("");
      setAppliedReply(null);
    }
  };

  const handleResolve = () => {
    if (activeConversation) resolveConversation(activeConversation.id);
  };

  const handleQuickBundle = async () => {
    if (!activeConversation) return;
    const bundleName =
      activeConversation.user.lookSummary?.[0]?.name ||
      activeConversation.user.viewedProducts[0] ||
      activeConversation.user.styleIdentity ||
      "LOOK";

    await sendBundlePush("look-id", bundleName);
  };

  const handleQuickQuestion = () => {
    if (topReply) {
      applyReply(topReply);
      return;
    }

    if (salesCopilotPlan?.primaryAction.message) {
      setInputText(salesCopilotPlan.primaryAction.message);
      setAppliedReply(null);
    }
  };

  const handleQuickFollowUp = async () => {
    if (!activeConversation) return;
    await setFollowUp(activeConversation.id);
  };

  const handleAiAssist = () => {
    if (!topReply) return;
    applyReply(topReply);
  };

  const handleProductAction = async () => {
    if (!activeConversation) return;
    const label =
      activeConversation.user.viewedProducts[0] ||
      activeConversation.user.styleIdentity ||
      "curadoria";

    await sendProductLink("prod-id", label);
  };

  const handleEmojiAction = () => {
    setInputText((current) => `${current}${current ? " " : ""}✨`);
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#0a0a0a] text-[#F5F5F0]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin border-2 border-[#C9A84C]/20 border-t-[#C9A84C]" />
          <Text className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/35">
            MISSION CONTROL LOADING
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden bg-[#0a0a0a] text-[#F5F5F0]">
      <div className="grid h-full grid-cols-[260px_minmax(0,1fr)_300px] overflow-hidden">
        <InboxConversationList
          conversations={filteredConversations}
          activeConversationId={activeConversation?.id || null}
          activeCount={activeCount}
          search={search}
          onSearch={setSearch}
          onSelectConversation={setActiveConversation}
        />

        <InboxChatPanel
          storeName={storeName}
          conversation={activeConversation}
          inputText={inputText}
          appliedReply={appliedReply}
          topReply={topReply}
          onInputText={setInputText}
          onApplyReply={applyReply}
          onSendReply={sendReply}
          onSendMessage={handleSendMessage}
          onFollowUp={handleQuickFollowUp}
          onResolve={handleResolve}
          onAiAssist={handleAiAssist}
          onProductAction={handleProductAction}
          onEmojiAction={handleEmojiAction}
        />

        <InboxIntelPanel
          conversation={activeConversation}
          smartReplyRanking={smartReplyRanking}
          rankedSmartReplies={rankedSmartReplies}
          rawSmartReplies={smartReplies}
          salesCopilotPlan={salesCopilotPlan}
          onQuickBundle={handleQuickBundle}
          onQuickQuestion={handleQuickQuestion}
          onQuickFollowUp={handleQuickFollowUp}
          onApplyReply={applyReply}
          onSendReply={sendReply}
        />
      </div>
    </div>
  );
}

export default function WhatsAppInboxPage() {
  return <WhatsAppInboxPageShell />;
}
