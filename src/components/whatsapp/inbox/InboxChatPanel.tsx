"use client";

import React from "react";
import { ArrowRight, BrainCircuit, MessageSquare, PackagePlus, Repeat2, Smile } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import type { SmartReplySuggestion, WhatsAppConversation } from "@/types/whatsapp";
import {
  getAvatarStyle,
  getConversationStatusMeta,
  groupMessages,
  formatShortTime,
  MESSAGE_STYLE_META,
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

  return (
    <main className="flex min-h-0 flex-1 flex-col border-r border-white/5 bg-[#0a0a0a]">
      <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-[#111] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center text-sm font-bold text-white"
            style={getAvatarStyle(conversation.user.name)}
          >
            {conversation.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 space-y-1">
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
            const meta = MESSAGE_STYLE_META[group.sender] ?? MESSAGE_STYLE_META.user;
            return (
              <div key={`${group.sender}-${index}`} className={`flex flex-col ${meta.alignClass}`}>
                <div className={`mb-1 px-1 text-[9px] uppercase tracking-[0.45em] ${meta.labelClass}`}>
                  {meta.label}
                </div>
                <div className="w-full max-w-[82%] space-y-2">
                  {group.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`border-l-2 ${meta.borderClass} ${meta.bubbleClass} rounded-none px-4 py-4`}
                    >
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                        {message.text}
                      </p>
                      <div className="mt-2 text-right text-[10px] uppercase tracking-[0.25em] text-[#444]">
                        {formatShortTime(message.timestamp)}
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
            <textarea
              value={inputText}
              onChange={(event) => onInputText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSendMessage();
                }
              }}
              placeholder={`Responda como ${storeName}...`}
              className="h-24 w-full resize-none border border-[#222] bg-[#0c0c0c] px-4 py-3 text-[13px] text-[#F5F5F0] outline-none placeholder:text-[#444] focus:border-[#C9A84C]/50"
            />
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
