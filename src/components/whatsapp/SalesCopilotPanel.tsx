"use client";

import React, { useState } from "react";
import { ArrowRight, BrainCircuit, MessageSquare, PackagePlus, Repeat2, Sparkles } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import type { SalesCopilotAction, SalesCopilotPlan } from "@/lib/whatsapp/sales-copilot";

type SalesCopilotPanelProps = {
  plan: SalesCopilotPlan;
  onSendMessage: (text: string) => Promise<void>;
  onApplyMessage: (text: string) => void;
  onSendProductLink: () => Promise<void>;
  onSendBundlePush: () => Promise<void>;
  onSetFollowUp: () => Promise<void>;
};

const ACTION_ICON_MAP: Record<SalesCopilotAction["kind"], React.ReactNode> = {
  send: <MessageSquare size={14} />,
  compose: <BrainCircuit size={14} />,
  bundle: <PackagePlus size={14} />,
  product: <Sparkles size={14} />,
  follow_up: <Repeat2 size={14} />,
};

export function SalesCopilotPanel({
  plan,
  onSendMessage,
  onApplyMessage,
  onSendProductLink,
  onSendBundlePush,
  onSetFollowUp,
}: SalesCopilotPanelProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const handlePrimary = async () => {
    if (!plan.primaryAction.message) return;
    setPendingAction(plan.primaryAction.id);
    try {
      await onSendMessage(plan.primaryAction.message);
    } finally {
      setPendingAction(null);
    }
  };

  const handleApply = () => {
    if (!plan.primaryAction.message) return;
    onApplyMessage(plan.primaryAction.message);
  };

  const handleQuickAction = async (action: SalesCopilotAction) => {
    setPendingAction(action.id);
    try {
      switch (action.kind) {
        case "send":
          if (action.message) {
            await onSendMessage(action.message);
          }
          break;
        case "compose":
          if (action.message) {
            onApplyMessage(action.message);
          }
          break;
        case "bundle":
          await onSendBundlePush();
          break;
        case "product":
          await onSendProductLink();
          break;
        case "follow_up":
          await onSetFollowUp();
          break;
      }
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="space-y-4">
      <Heading as="h4" className="text-[10px] uppercase font-bold tracking-[0.24em] text-white/30 px-2">
        Vendedor WhatsApp
      </Heading>
      <div className="rounded-[32px] border border-[#D4AF37]/15 bg-gradient-to-b from-[#D4AF37]/8 to-white/[0.02] p-5 shadow-[0_20px_60px_rgba(212,175,55,0.08)] space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.28em] text-[#D4AF37]">
              <Sparkles size={10} />
              Super seller
            </div>
            <Heading as="h3" className="text-lg leading-tight tracking-tight">
              {plan.title}
            </Heading>
            <Text className="text-[11px] text-white/55 leading-relaxed">
              {plan.subtitle}
            </Text>
          </div>
          <div className="shrink-0 text-right space-y-1">
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/45">
              {plan.badge}
            </div>
            <div className="text-[9px] uppercase tracking-[0.24em] text-white/25">
              {plan.stats.intentScore}% intenção
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
            <Text className="text-[8px] uppercase tracking-[0.24em] text-white/30 font-bold">Status</Text>
            <div className="mt-1 text-[11px] font-semibold text-white/90 capitalize">
              {plan.stats.status.replace("_", " ")}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
            <Text className="text-[8px] uppercase tracking-[0.24em] text-white/30 font-bold">Try-ons</Text>
            <div className="mt-1 text-[11px] font-semibold text-white/90">
              {plan.stats.tryOnCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
            <Text className="text-[8px] uppercase tracking-[0.24em] text-white/30 font-bold">Produtos</Text>
            <div className="mt-1 text-[11px] font-semibold text-white/90">
              {plan.stats.viewedProductsCount}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Text className="text-[8px] uppercase tracking-[0.24em] text-[#D4AF37] font-bold">Por que agora</Text>
          <p className="text-[11px] leading-relaxed text-white/65">
            {plan.reason}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/5 bg-black/25 p-4 space-y-3">
          <Text className="text-[8px] uppercase tracking-[0.24em] text-white/30 font-bold">Mensagem pronta</Text>
          <p className="text-[12px] leading-relaxed text-white/90">
            {plan.primaryAction.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <VenusButton
              type="button"
              onClick={handlePrimary}
              disabled={pendingAction === plan.primaryAction.id}
              className="w-full sm:flex-1 justify-center gap-2"
            >
              {pendingAction === plan.primaryAction.id ? "Enviando..." : plan.primaryAction.label}
              <ArrowRight size={14} />
            </VenusButton>
            <button
              type="button"
              onClick={handleApply}
              className="w-full sm:w-auto rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              Editar no campo
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          {plan.quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => void handleQuickAction(action)}
              disabled={pendingAction === action.id}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 disabled:opacity-70"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-full border border-white/10 bg-black/25 p-2 text-[#D4AF37]">
                  {ACTION_ICON_MAP[action.kind]}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white">
                    {pendingAction === action.id ? "Executando..." : action.label}
                  </div>
                  {action.helper && (
                    <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/30">
                      {action.helper}
                    </div>
                  )}
                </div>
              </div>
              <ArrowRight size={14} className="shrink-0 text-white/25" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
