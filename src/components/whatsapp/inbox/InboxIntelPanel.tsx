"use client";

import React from "react";
import { ArrowRight, BrainCircuit, PackagePlus, Repeat2, Sparkles } from "lucide-react";
import type { SmartReplyOrgRanking } from "@/lib/whatsapp/smart-reply-ranking";
import type { SmartReplySuggestion, WhatsAppConversation } from "@/types/whatsapp";
import {
  formatCompactNumber,
  formatPercent,
  getConversationStatusMeta,
  REPLY_ROW_ANGLES,
} from "./inbox-utils";

type InboxIntelPanelProps = {
  conversation: WhatsAppConversation | null;
  smartReplyRanking: SmartReplyOrgRanking | null;
  rankedSmartReplies: SmartReplySuggestion[];
  rawSmartReplies: SmartReplySuggestion[];
  salesCopilotPlan: {
    badge: string;
    title: string;
    subtitle: string;
    reason: string;
    stage: "close" | "warm" | "support" | "follow_up";
    stats: {
      intentScore: number;
      tryOnCount: number;
      viewedProductsCount: number;
      status: WhatsAppConversation["status"];
    };
    primaryAction: {
      message?: string;
    };
  } | null;
  onQuickBundle: () => Promise<void>;
  onQuickQuestion: () => void;
  onQuickFollowUp: () => Promise<void>;
  onApplyReply: (reply: SmartReplySuggestion) => void;
  onSendReply: (reply: SmartReplySuggestion) => Promise<void>;
};

function MissionControlGauge({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  const radius = 36;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#222" strokeWidth={stroke} />
        <defs>
          <linearGradient id="urgency-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00FF88" />
            <stop offset="55%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#FF3B3B" />
          </linearGradient>
        </defs>
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="url(#urgency-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[18px] tracking-[0.08em] text-[#C9A84C]">
          {formatCompactNumber(Math.round(normalized))}
        </span>
        <span className="text-[8px] uppercase tracking-[0.35em] text-white/25">urgency</span>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.35em] text-[#C9A84C]">{title}</div>
      {subtitle ? <div className="text-[9px] uppercase tracking-[0.25em] text-white/30">{subtitle}</div> : null}
    </div>
  );
}

export function InboxIntelPanel({
  conversation,
  smartReplyRanking,
  rankedSmartReplies,
  rawSmartReplies,
  salesCopilotPlan,
  onQuickBundle,
  onQuickQuestion,
  onQuickFollowUp,
  onApplyReply,
  onSendReply,
}: InboxIntelPanelProps) {
  if (!conversation) {
    return (
      <aside className="flex min-h-0 flex-col overflow-y-auto bg-[#111]">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div className="space-y-3 opacity-40">
            <div className="mx-auto flex h-20 w-20 items-center justify-center border border-white/5 bg-white/[0.03]">
              <Sparkles size={30} />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">PAINEL INTEL</div>
              <p className="text-[11px] leading-relaxed text-white/35">
                Selecione uma conversa para ver a leitura de intent, urgencia e respostas prontas.
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const statusMeta = getConversationStatusMeta(conversation.status);
  const urgencyValue = Math.min(100, Math.max(0, Math.round(conversation.user.intentScore)));
  const currentMode = salesCopilotPlan?.stage === "close" ? "HORA DE FECHAR" : "SUPER SELLER";
  const topAngle = smartReplyRanking?.hasData ? smartReplyRanking.bestAngle?.toUpperCase() ?? "SEM DADOS" : "SEM DADOS";

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto bg-[#111]">
      <div className="space-y-6 px-4 py-4">
        <section className="space-y-3">
          <SectionHeader title="CLIENTE" />
          <div className="space-y-3 border border-white/5 bg-[#0c0c0c] p-4">
            <div className="space-y-1">
              <div className="text-[15px] font-bold uppercase tracking-tight text-[#F5F5F0]">
                {conversation.user.name}
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/35">
                {conversation.user.phone}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.35em] text-white/30">INTENT SCORE</span>
                <span className="font-mono text-[15px] text-[#C9A84C]">
                  {formatCompactNumber(Math.round(conversation.user.intentScore))}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden bg-[#1a1a1a]">
                <div
                  className="h-full bg-gradient-to-r from-[#00FF88] via-[#C9A84C] to-[#FF3B3B]"
                  style={{ width: `${Math.max(0, Math.min(100, conversation.user.intentScore))}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.28em] ${statusMeta.badge}`}>
                {statusMeta.label}
              </span>
              <span className="inline-flex border border-white/10 bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/45">
                {conversation.user.tryOnCount} TRY-ONS
              </span>
              <span className="inline-flex border border-white/10 bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/45">
                {conversation.user.viewedProducts.length} PRODUCTS
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader title="INTELIGENCIA DA CONVERSA" />
          <div className="space-y-4 border border-white/5 bg-[#0c0c0c] p-4">
            <div className="space-y-2">
              <div className="text-[22px] font-bold uppercase tracking-tight text-[#F5F5F0]">
                {currentMode}
              </div>
              <p className="text-[11px] leading-relaxed text-[#999]">
                {salesCopilotPlan?.reason ||
                  "Sem leitura suficiente para um comando de venda. Mantenha o contexto curto e direto."}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="text-[8px] uppercase tracking-[0.35em] text-white/30">PAINEL DE URGENCIA</div>
                <div className="max-w-[150px] text-[10px] leading-relaxed text-white/45">
                  {salesCopilotPlan?.subtitle ||
                    "O leitor de intencao aponta o momento ideal para conduzir a conversa."}
                </div>
              </div>
              <MissionControlGauge value={urgencyValue} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader title="ACAO RECOMENDADA" />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void onQuickBundle()}
              className="group flex w-full items-center justify-between border border-[#222] border-l-2 border-l-transparent bg-[#161616] px-4 py-4 text-left transition-colors duration-75 hover:border-l-[#C9A84C] hover:bg-[#1f1f1f]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-[#F5F5F0]">
                  <PackagePlus size={14} className="text-[#C9A84C]" />
                  MANDAR LOOK COMPLETO
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">
                  Acelera o fechamento com a leitura completa
                </div>
              </div>
              <ArrowRight size={14} className="text-white/30 transition-transform duration-75 group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={onQuickQuestion}
              className="group flex w-full items-center justify-between border border-[#222] border-l-2 border-l-transparent bg-[#161616] px-4 py-4 text-left transition-colors duration-75 hover:border-l-[#C9A84C] hover:bg-[#1f1f1f]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-[#F5F5F0]">
                  <BrainCircuit size={14} className="text-[#C9A84C]" />
                  ABRIR COM PERGUNTA
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">
                  Qualifica sem perder o ritmo da conversa
                </div>
              </div>
              <ArrowRight size={14} className="text-white/30 transition-transform duration-75 group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => void onQuickFollowUp()}
              className="group flex w-full items-center justify-between border border-[#222] border-l-2 border-l-transparent bg-[#161616] px-4 py-4 text-left transition-colors duration-75 hover:border-l-[#C9A84C] hover:bg-[#1f1f1f]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-[#F5F5F0]">
                  <Repeat2 size={14} className="text-[#C9A84C]" />
                  PUXAR RETORNO
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">
                  Volta para a fila de acompanhamento
                </div>
              </div>
              <ArrowRight size={14} className="text-white/30 transition-transform duration-75 group-hover:translate-x-0.5" />
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader title="RESPOSTAS PRONTAS" />
          <div className="space-y-3 border border-white/5 bg-[#0c0c0c] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[8px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">TOP ANGLE</div>
                <div className="text-[12px] uppercase tracking-tight text-[#F5F5F0]">
                  {smartReplyRanking?.hasData ? topAngle : "SEM DADOS SUFICIENTES"}
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/35">
                  {smartReplyRanking?.hasData
                    ? `Amostra valida de ${formatCompactNumber(smartReplyRanking.rankedAngles[0]?.totalSent || 0)} envios`
                    : "Aguardando volume para ranquear os angulos da org"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] uppercase tracking-[0.35em] text-white/30">MODE</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#C9A84C]">
                  {currentMode}
                </div>
              </div>
            </div>

            {smartReplyRanking?.hasData ? (
              <div className="space-y-2">
                {REPLY_ROW_ANGLES.map((row) => {
                  const reply =
                    rankedSmartReplies.find((item) => item.angle === row.metricAngle) ||
                    rawSmartReplies.find((item) => item.angle === row.metricAngle);
                  const performance = smartReplyRanking.rankedAngles.find((item) => item.angle === row.metricAngle);
                  const hasReply = Boolean(reply);

                  return (
                    <div key={row.label} className="border border-white/5 bg-[#121212] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#F5F5F0]">
                            {row.label}
                          </div>
                          <div className="text-[9px] uppercase tracking-[0.24em] text-white/35">
                            {row.description}
                          </div>
                        </div>
                        <div className="space-y-1 text-right font-mono text-[10px] text-[#C9A84C]">
                          <div>Reply {formatPercent(performance?.customerReplyRate)}</div>
                          <div>Send {formatPercent(performance?.sentRate)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!hasReply}
                          onClick={() => {
                            if (reply) onApplyReply(reply);
                          }}
                          className="inline-flex items-center gap-1 border border-white/10 bg-[#161616] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.28em] text-[#F5F5F0] transition-colors duration-75 hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          REPLY <ArrowRight size={10} />
                        </button>
                        <button
                          type="button"
                          disabled={!hasReply}
                          onClick={() => {
                            if (reply) void onSendReply(reply);
                          }}
                          className="inline-flex items-center gap-1 border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.28em] text-[#C9A84C] transition-colors duration-75 hover:bg-[#C9A84C]/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          SEND <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-white/5 bg-[#121212] p-4 text-[11px] leading-relaxed text-white/45">
                Sem volume suficiente para ranquear os angulos desta org. As respostas continuam disponiveis em
                modo manual e o inbox segue operando normalmente.
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
