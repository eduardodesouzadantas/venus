"use client";

import React from "react";
import { ArrowRight, BrainCircuit, MessageSquare, PackagePlus, Repeat2, Smile } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusAvatar } from "@/components/venus/VenusAvatar";
import type { SmartReplySuggestion, WhatsAppConversation } from "@/types/whatsapp";
import {
  getAvatarStyle,
  getConversationStatusMeta,
  groupMessages,
  formatShortTime,
} from "./inbox-utils";

type InboxChatPanelProps = {
  storeName: string;
  conversation: WhatsAppConversation | null;
  inputText: string;
  appliedReply: SmartReplySuggestion | null;
  topReply: SmartReplySuggestion | null;
  onInputText: (value: string) => void;
  onApplyReply: (reply: SmartReplySuggestion) => void;
  onSendReply: (reply: SmartReplySuggestion) => Promise<void>;
  onSendMessage: () => Promise<void>;
  onFollowUp: () => Promise<void>;
  onResolve: () => void;
  onAiAssist: () => void;
  onProductAction: () => Promise<void>;
  onEmojiAction: () => void;
};

export function InboxChatPanel({
  storeName,
  conversation,
  inputText,
  appliedReply,
  topReply,
  onInputText,
  onApplyReply,
  onSendReply,
  onSendMessage,
  onFollowUp,
  onResolve,
  onAiAssist,
  onProductAction,
  onEmojiAction,
}: InboxChatPanelProps) {
  if (!conversation) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-3 text-center opacity-40">
          <div className="mx-auto flex h-20 w-20 items-center justify-center border border-white/5 bg-white/[0.03]">
            <MessageSquare size={32} />
          </div>
          <div className="space-y-1">
            <Heading as="h3" className="text-xl uppercase tracking-[0.35em]">
              SELECIONE UMA CONVERSA
            </Heading>
            <Text className="text-[10px] uppercase tracking-[0.35em] text-white/35">
              Mission control pronto para operar
            </Text>
          </div>
        </div>
      </main>
    );
  }

  const groupedMessages = groupMessages(conversation.messages);
  const headerStatusMeta = getConversationStatusMeta(conversation.status);
  const isAiActive = conversation.status === "ai_active";

  const getMessageStyle = (sender: string) => {
    if (sender === "venus" || sender === "ai") {
      return {
        label: "VENUS IA",
        labelColor: "#00FF88",
        background: "#0a1a0a",
        borderLeft: "2px solid #00FF88",
        color: "#b8ffb8",
        alignClass: "items-end",
      };
    }

    if (sender === "merchant" || sender === "agent") {
      return {
        label: "VOCÊ",
        labelColor: "#C9A84C",
        background: "#1a1500",
        borderLeft: "2px solid #C9A84C",
        color: "#fff0c0",
        alignClass: "items-end",
      };
    }

    return {
      label: "CLIENTE",
      labelColor: "#555",
      background: "#141414",
      borderLeft: "2px solid #2a2a2a",
      color: "#e0e0e0",
      alignClass: "items-start",
    };
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col border-r border-white/5 bg-[#0a0a0a]">
      <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-[#111] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {isAiActive ? (
            <VenusAvatar size={36} animated />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center text-sm font-bold text-white"
              style={getAvatarStyle(conversation.user.name)}
            >
              {conversation.user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            {isAiActive ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <Heading as="h3" className="truncate text-[16px] font-bold uppercase tracking-[0.2em] text-[#F5F5F0]">
                    Venus
                  </Heading>
                  <span className="inline-flex items-center border border-[#00FF88]/20 bg-[#00FF88]/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-[#00FF88]">
                    AI ACTIVE
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#00FF88]">
                  <span>● online agora</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <Heading as="h3" className="truncate text-[16px] font-bold uppercase tracking-[0.2em] text-[#F5F5F0]">
                    {conversation.user.name}
                  </Heading>
                  <span className={`inline-flex items-center border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.3em] ${headerStatusMeta.badge}`}>
                    {headerStatusMeta.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/35">
                  <span>{conversation.user.phone}</span>
                  <span className="text-white/15">|</span>
                  <span>{conversation.status.replaceAll("_", " ")}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onFollowUp()}
            className="border border-white/10 bg-[#111] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.28em] text-[#F5F5F0] transition-colors duration-75 hover:bg-[#1a1a1a]"
          >
            FOLLOW-UP
          </button>
          <button
            type="button"
            onClick={onResolve}
            className="border border-[#C9A84C] bg-[#C9A84C] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.28em] text-black transition-colors duration-75 hover:opacity-90"
          >
            RESOLVER
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          {groupedMessages.map((group, index) => {
            const meta = getMessageStyle(group.sender);
            const showLabel = index === 0 || groupedMessages[index - 1]?.sender !== group.sender;
            const isVenusSender = String(group.sender) === "venus" || group.sender === "ai";
            return (
              <div key={`${group.sender}-${index}`} className={`flex flex-col ${meta.alignClass}`}>
                <div className="w-full max-w-[82%] space-y-2">
                  {showLabel ? (
                    <div className="mb-1 flex items-center gap-2 px-1 text-[9px] uppercase tracking-[0.15em]" style={{ color: meta.labelColor }}>
                      {isVenusSender ? <VenusAvatar size={16} animated={false} /> : null}
                      <span>{meta.label}</span>
                    </div>
                  ) : null}
                  {group.messages.map((message) => (
                    <div key={message.id} className="flex flex-col">
                      <div
                        className="border-l-2 rounded-none px-4 py-3"
                        style={{
                          background: meta.background,
                          borderLeft: meta.borderLeft,
                          color: meta.color,
                          borderRadius: 0,
                          padding: "12px 16px",
                          marginBottom: "2px",
                        }}
                      >
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed" style={{ color: meta.color }}>
                          {message.text}
                        </p>
                        <div className="mt-2 text-right text-[10px] uppercase tracking-[0.25em] text-[#444]">
                          {formatShortTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div />
        </div>
      </div>

      <footer className="border-t border-[#222] bg-[#111]">
        {appliedReply ? (
          <div className="border-b border-[#222] px-5 py-2 text-[9px] uppercase tracking-[0.3em] text-[#C9A84C]">
            SMART REPLY ARMADO: {appliedReply.label}
          </div>
        ) : null}

        <div className="flex items-end gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAiAssist}
              className="flex h-10 w-10 items-center justify-center border border-[#222] bg-[#0c0c0c] text-[#C9A84C] transition-colors duration-75 hover:bg-[#1a1a1a]"
              title="IA sugerir resposta"
              aria-label="IA sugerir resposta"
            >
              <BrainCircuit size={15} />
            </button>
            <button
              type="button"
              onClick={() => void onProductAction()}
              className="flex h-10 w-10 items-center justify-center border border-[#222] bg-[#0c0c0c] text-[#C9A84C] transition-colors duration-75 hover:bg-[#1a1a1a]"
              title="Enviar produto"
              aria-label="Enviar produto"
            >
              <PackagePlus size={15} />
            </button>
            <button
              type="button"
              onClick={onEmojiAction}
              className="flex h-10 w-10 items-center justify-center border border-[#222] bg-[#0c0c0c] text-[#F5F5F0] transition-colors duration-75 hover:bg-[#1a1a1a]"
              title="Emoji"
              aria-label="Emoji"
            >
              <Smile size={15} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {isAiActive ? <VenusAvatar size={20} animated={false} /> : null}
              <textarea
                value={inputText}
                onChange={(event) => onInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void onSendMessage();
                  }
                }}
                placeholder={isAiActive ? "A Venus está ativa — ou responda você..." : `Responda como ${storeName}...`}
                className="h-24 w-full resize-none border border-[#222] bg-[#0c0c0c] px-4 py-3 text-[13px] text-[#F5F5F0] outline-none placeholder:text-[#444] focus:border-[#C9A84C]/50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onSendMessage()}
            className="flex h-10 w-10 items-center justify-center bg-[#C9A84C] text-white transition-colors duration-75 hover:bg-[#b8943f]"
            title="Enviar"
            aria-label="Enviar"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        {topReply ? (
          <div className="border-t border-[#222] px-5 py-2 text-[9px] uppercase tracking-[0.3em] text-white/35">
            TOP SIGNAL: {topReply.label}
          </div>
        ) : null}
      </footer>
    </main>
  );
}
