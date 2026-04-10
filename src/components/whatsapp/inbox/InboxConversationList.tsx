"use client";

import React from "react";
import { Search } from "lucide-react";
import type { WhatsAppConversation } from "@/types/whatsapp";
import { formatCompactNumber, formatShortTime, getAvatarStyle, getConversationStatusMeta } from "./inbox-utils";

type InboxConversationListProps = {
  conversations: WhatsAppConversation[];
  activeConversationId: string | null;
  activeCount: number;
  search: string;
  onSearch: (value: string) => void;
  onSelectConversation: (id: string) => void;
};

export function InboxConversationList({
  conversations,
  activeConversationId,
  activeCount,
  search,
  onSearch,
  onSelectConversation,
}: InboxConversationListProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-white/5 bg-[#111]">
      <div className="border-b border-white/5 px-4 py-4">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.45em] text-[#C9A84C]">
            CONVERSAS
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-[#C9A84C] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-black">
              {formatCompactNumber(activeCount)} ATIVAS
            </span>
            <span className="inline-flex items-center gap-2 border border-white/10 bg-[#0f0f0f] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF88]" />
              </span>
              AO VIVO
            </span>
          </div>
        </div>

        <label className="mt-4 flex h-10 items-center gap-2 border border-white/10 bg-[#0c0c0c] px-3">
          <Search size={14} className="text-white/25" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-transparent text-[11px] text-[#F5F5F0] outline-none placeholder:text-white/25"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length > 0 ? (
          conversations.map((conversation) => {
            const isActive = activeConversationId === conversation.id;
            const statusMeta = getConversationStatusMeta(conversation.status);
            const initial = conversation.user.name.charAt(0).toUpperCase();
            const preview = conversation.lastMessage || "Nova conversa";

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
                className={`group flex w-full border-l-2 border-b border-white/[0.04] text-left transition-colors duration-75 ${
                  isActive ? "bg-[#1a1a1a]" : "bg-transparent hover:bg-[#1a1a1a]"
                }`}
                style={{ borderLeftColor: isActive ? statusMeta.rail : "transparent" }}
              >
                <div className="px-3 py-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center text-sm font-bold text-white"
                    style={getAvatarStyle(conversation.user.name)}
                  >
                    {initial}
                  </div>
                </div>
                <div className="min-w-0 flex-1 py-3 pr-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate text-[12px] font-bold text-[#F5F5F0]">
                      {conversation.user.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#666]">
                      {formatShortTime(conversation.lastUpdated)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-[#888]">{preview}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.28em] ${statusMeta.badge}`}>
                      {statusMeta.label}
                    </span>
                    {conversation.priority === "high" ? (
                      <span className="inline-flex items-center border border-[#FF3B3B]/20 bg-[#FF3B3B]/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.28em] text-[#FF3B3B]">
                        HIGH
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.4em] text-white/25">SEM CONVERSAS</div>
              <p className="text-[11px] leading-relaxed text-white/30">
                Nenhum lead corresponde a esta busca.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
