import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, ExternalLink, History, MessageSquare, Send, Sparkles, Target } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { createClient } from "@/lib/supabase/server";
import { loadMerchantActionPanel } from "@/lib/merchant/action-panel";

type MerchantActionPanelProps = {
  orgId: string;
  orgSlug: string;
  orgBase: string;
  actionError?: string | null;
};

function formatCardStatus(priority: "high" | "medium" | "low") {
  switch (priority) {
    case "high":
      return "text-red-300 border-red-500/20 bg-red-500/10";
    case "medium":
      return "text-amber-300 border-amber-500/20 bg-amber-500/10";
    default:
      return "text-white/60 border-white/10 bg-white/5";
  }
}

function formatLeadStatusLabel(status: string | null) {
  switch (status) {
    case "new":
      return "Novo";
    case "engaged":
      return "Em conversa";
    case "qualified":
      return "Qualificado";
    case "offer_sent":
      return "Oferta enviada";
    case "closing":
      return "Fechamento";
    case "won":
      return "Ganho";
    case "lost":
      return "Perdido";
    default:
      return "Lead";
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "agora";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActionFormShell({
  action,
  children,
  className,
}: {
  action: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} method="post" className={className}>
      {children}
    </form>
  );
}

export async function MerchantActionPanel({ orgId, orgSlug, orgBase, actionError }: MerchantActionPanelProps) {
  const supabase = await createClient();
  const panel = await loadMerchantActionPanel(supabase, { orgId, orgSlug });
  const redirectTo = `${orgBase}/dashboard`;

  return (
    <section className="mb-6 space-y-4 rounded-[32px] border border-white/5 bg-[linear-gradient(180deg,rgba(201,168,76,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">Painel de Ações</Text>
          <Heading as="h3" className="text-xl uppercase tracking-tight">
            Quem está quente, quem esfriou e o que fazer agora
          </Heading>
          <Text className="max-w-3xl text-sm text-white/50">
            Cards reais de leads, try-ons e WhatsApp para abrir conversa, marcar status, enviar follow-up e revisar resultado sem sair do fluxo.
          </Text>
        </div>

        <div className="flex flex-wrap gap-2 text-[8px] font-bold uppercase tracking-[0.28em]">
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-red-300">Quentes {panel.summary.hot}</span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-300">Follow-up {panel.summary.followUpsDue}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">Conversas {panel.summary.openConversations}</span>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">Resultados {panel.summary.resultReady}</span>
        </div>
      </div>

      {actionError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {actionError}
        </div>
      ) : null}

      {panel.state === "partial" && panel.errors.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          O painel carregou com dados parciais. A origem real continua ativa, mas alguns sinais secundários falharam.
        </div>
      ) : null}

      {panel.state === "error" ? (
        <div className="rounded-[28px] border border-white/5 bg-black/30 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300">
              <Target size={18} />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-300">Painel indisponível</div>
              <p className="text-sm text-white/55">
                Não foi possível carregar os leads operacionais agora. O fluxo do CRM continua disponível.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`${orgBase}/crm`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/80 hover:bg-white/10">
              Abrir CRM
              <ExternalLink size={12} />
            </Link>
            <Link href={`${orgBase}/whatsapp/inbox`} className="inline-flex items-center gap-2 rounded-full bg-[#C9A84C] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-black hover:opacity-90">
              Ver WhatsApp
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      ) : null}

      {panel.cards.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            {panel.cards.map((card) => {
              const statusTone = formatCardStatus(card.priority);
              const markStatusLabel = card.suggestedStatus ? formatLeadStatusLabel(card.suggestedStatus) : null;

              return (
                <article
                  key={card.id}
                  className="rounded-[28px] border border-white/5 bg-black/35 p-5 transition-colors hover:bg-black/45"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] ${statusTone}`}>
                          {card.priority === "high" ? "Alta prioridade" : card.priority === "medium" ? "Prioridade média" : "Prioridade baixa"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/50">
                          Score {card.score}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/50">
                          Conversão {card.conversionScore}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/50">
                          Urgência {card.urgencyScore}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.28em] text-white/50">
                          {card.leadStatus === "new" ? "novo" : card.leadStatus}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-white">{card.title}</h4>
                        <p className="text-sm text-white/55">{card.summary}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {card.evidence.map((evidence) => (
                          <span
                            key={`${card.id}:${evidence}`}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.24em] text-white/45"
                          >
                            {evidence}
                          </span>
                        ))}
                      </div>

                      <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                        <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-white/35">
                          Motivos da recomendação
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {card.recommendationReasons.length > 0 ? (
                            card.recommendationReasons.map((reason) => (
                              <span
                                key={`${card.id}:reason:${reason}`}
                                className="rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-[#E7D08B]"
                              >
                                {reason}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-white/35">Sem sinais fortes adicionais.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link
                        href={card.conversationHref}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/80 hover:bg-white/10"
                      >
                        Abrir conversa
                        <MessageSquare size={12} />
                      </Link>

                      {card.resultHref ? (
                        <Link
                          href={card.resultHref}
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-200 hover:bg-emerald-500/15"
                        >
                          Ver resultado
                          <ExternalLink size={12} />
                        </Link>
                      ) : null}

                      {markStatusLabel && card.suggestedStatus ? (
                        <ActionFormShell action={`/api/org/${orgSlug}/leads/${card.leadId}`} className="inline-flex">
                          <input type="hidden" name="status" value={card.suggestedStatus} />
                          <input type="hidden" name="return_to" value={redirectTo} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/20 bg-[#C9A84C] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-black hover:opacity-90"
                          >
                            Marcar como {markStatusLabel}
                            <ArrowRight size={12} />
                          </button>
                        </ActionFormShell>
                      ) : null}

                      {card.phone && card.followUpText ? (
                        <ActionFormShell action={`/api/org/${orgSlug}/whatsapp/send`} className="inline-flex">
                          <input type="hidden" name="to" value={card.phone} />
                          <input type="hidden" name="text" value={card.followUpText} />
                          <input type="hidden" name="return_to" value={redirectTo} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-black hover:bg-white/90"
                          >
                            Enviar follow-up
                            <Send size={12} />
                          </button>
                        </ActionFormShell>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[9px] uppercase tracking-[0.25em] text-white/35">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {card.followUpAt ? `Follow-up ${formatTimestamp(card.followUpAt)}` : "Sem follow-up"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {card.resultLabel || "Resultado ainda não etiquetado"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {card.messageTone}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="rounded-[28px] border border-white/5 bg-black/30 p-5">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">Histórico básico</Text>
                <Heading as="h4" className="text-lg uppercase tracking-tight">
                  Últimas ações reais
                </Heading>
              </div>
              <History size={16} className="text-white/30" />
            </div>

            <div className="mt-4 space-y-3">
              {panel.history.length > 0 ? (
                panel.history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-white/70">
                        {item.kind === "whatsapp" ? <MessageSquare size={14} /> : item.kind === "tryon" ? <Sparkles size={14} /> : <Clock3 size={14} />}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/65">{item.title}</span>
                          <span className="text-[8px] uppercase tracking-[0.24em] text-white/25">{formatTimestamp(item.timestamp)}</span>
                        </div>
                        <p className="text-sm text-white/50">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/45">
                  Ainda não houve movimentação suficiente para montar um histórico útil.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-dashed border-white/10 bg-black/25 p-6 text-sm text-white/45">
            Nenhum card de ação prioritária no momento. Quando houver leads, try-ons ou WhatsApp ativos, eles aparecem aqui primeiro.
          </div>
          <aside className="rounded-[28px] border border-white/5 bg-black/30 p-5">
            <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">Histórico básico</Text>
            <p className="mt-2 text-sm text-white/45">
              O histórico surge assim que o time começa a operar leads, resultados e conversas nesta org.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
