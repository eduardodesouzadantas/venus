import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Gift, Sparkles, Share2 } from "lucide-react";

import {
  GAMIFICATION_BENEFIT_RESOURCE_TYPES,
  GAMIFICATION_RULE_TYPES,
  GAMIFICATION_TRIGGER_EVENT_TYPES,
  gamificationResourceLabel,
  gamificationRuleLabel,
  gamificationTriggerEventLabel,
  gamificationTriggerModeLabel,
  loadGamificationOverview,
  type GamificationEventRecord,
  type GamificationRuleRecord,
} from "@/lib/gamification";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "0";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "sem validade";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function toneChip(active: boolean) {
  return active
    ? "border-green-500/20 bg-green-500/10 text-green-300"
    : "border-white/10 bg-white/5 text-white/45";
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[34px] border border-white/5 bg-white/[0.03] p-5 md:p-7">
      <div className="space-y-1">
        <Heading as="h2" className="text-xl tracking-tight">
          {title}
        </Heading>
        {description ? <Text className="text-sm text-white/50 leading-relaxed">{description}</Text> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-white/45">{sub}</div>
    </div>
  );
}

export default async function GamificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const paramsResolved = await searchParams;

  if (process.env.GAMIFICATION_BUDGET_AWARE_ENABLED === "false") {
    redirect(`/org/${slug}/dashboard`);
  }

  try {
    const access = await resolveMerchantOrgAccess(slug);
    const overview = await loadGamificationOverview(access.org.id);
    const saved = normalize(paramsResolved.saved);
    const error = normalize(paramsResolved.error);
    const orgBase = `/org/${slug}`;
    const activeRules = overview.rules.filter((rule) => rule.active);
    const inactiveRules = overview.rules.filter((rule) => !rule.active);
    const recentAutomaticByRule = new Map<string, GamificationEventRecord>();

    for (const event of overview.recent_automatic_events) {
      if (event.rule_id && !recentAutomaticByRule.has(event.rule_id)) {
        recentAutomaticByRule.set(event.rule_id, event);
      }
    }

    return (
      <div className="min-h-screen bg-black text-white flex">
        <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
          <Link href={`${orgBase}/dashboard`} className="flex items-center gap-3 px-2 group">
            <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">
              Dashboard
            </span>
          </Link>

          <nav className="flex-1 space-y-2">
            <NavItem href={`${orgBase}/dashboard`} icon={<ArrowLeft size={16} />} label="Dashboard" />
            <NavItem href={`${orgBase}/rewards`} icon={<Share2 size={16} />} label="Recompensas" />
            <NavItem href={`${orgBase}/gamification`} icon={<Sparkles size={16} />} label="Gamificação" active />
          </nav>
        </aside>

        <main className="flex-1 p-8 md:p-12 overflow-y-auto no-scrollbar">
          <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between mb-10">
            <div className="space-y-2">
              <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C]">
                {access.org.name || slug}
              </Text>
              <Heading as="h1" className="text-3xl md:text-4xl tracking-tighter uppercase leading-none">
                Gamificação budget-aware
              </Heading>
              <Text className="text-sm text-white/50 max-w-2xl">
                Regras declarativas, budget controlado pelo Resource Control Engine e saldo promocional auditável por
                cliente.
              </Text>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={`${orgBase}/dashboard`}>
                <VenusButton
                  variant="outline"
                  className="h-12 px-5 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium border-white/10"
                >
                  Voltar
                </VenusButton>
              </Link>
              <VenusButton
                type="button"
                variant="solid"
                className="h-12 px-6 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium bg-[#C9A84C] text-black"
              >
                {overview.active_rule_count} regras ativas
              </VenusButton>
            </div>
          </header>

          {saved === "1" ? (
            <div className="mb-6 rounded-3xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-100">
              Alteração salva com sucesso.
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6 mb-8">
            <StatCard
              label="Regras ativas"
              value={formatNumber(overview.active_rule_count)}
              sub={`${formatNumber(overview.inactive_rule_count)} inativas`}
            />
            <StatCard
              label="Automáticas"
              value={formatNumber(overview.automatic_rule_count)}
              sub={`${formatNumber(overview.automatic_blocked_events)} bloqueios automáticos`}
            />
            <StatCard
              label="Clientes recompensados"
              value={formatNumber(overview.recent_customers.length)}
              sub="recentes no saldo promocional"
            />
            <StatCard
              label="Promo concedido"
              value={formatNumber(overview.budget.total_granted)}
              sub="saldo distribuído"
            />
            <StatCard
              label="Promo restante"
              value={formatNumber(overview.budget.total_available)}
              sub={`${formatNumber(overview.blocked_events)} bloqueios`}
            />
            <StatCard
              label="Automações recentes"
              value={formatNumber(overview.recent_automatic_events.filter((event) => event.status === "success").length)}
              sub="disparos confiáveis no feed"
            />
            <StatCard
              label="Último disparo"
              value={overview.last_automatic_event_at ? formatDate(overview.last_automatic_event_at) : "—"}
              sub="automação recente"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-6">
              <Panel
                title="Nova regra"
                description="Configure recompensa, teto por cliente e validade. O backend valida budget e tenant antes de salvar."
              >
                <form action={`/api/org/${slug}/gamification`} method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="create_rule" />
                  <input type="hidden" name="redirect_to" value={`/org/${slug}/gamification`} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome da regra">
                      <input
                        name="label"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                        placeholder="Ex: bônus por share"
                      />
                    </Field>

                    <Field label="Tipo de regra">
                      <select
                        name="rule_type"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                        defaultValue="share_bonus"
                      >
                        {GAMIFICATION_RULE_TYPES.map((ruleType) => (
                          <option key={ruleType} value={ruleType}>
                            {gamificationRuleLabel(ruleType)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Modo da regra">
                      <select
                        name="trigger_mode"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                        defaultValue="manual"
                      >
                        <option value="manual">{gamificationTriggerModeLabel("manual")}</option>
                        <option value="automatic">{gamificationTriggerModeLabel("automatic")}</option>
                      </select>
                    </Field>

                    <Field label="Evento observado">
                      <select
                        name="trigger_event_type"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                        defaultValue=""
                      >
                        <option value="">Manual</option>
                        {GAMIFICATION_TRIGGER_EVENT_TYPES.map((eventType) => (
                          <option key={eventType} value={eventType}>
                            {gamificationTriggerEventLabel(eventType)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Recurso concedido">
                      <select
                        name="benefit_resource_type"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                        defaultValue="try_on"
                      >
                        {GAMIFICATION_BENEFIT_RESOURCE_TYPES.map((resourceType) => (
                          <option key={resourceType} value={resourceType}>
                            {gamificationResourceLabel(resourceType)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Quantidade concedida">
                      <input
                        name="benefit_amount"
                        type="number"
                        min="1"
                        defaultValue={1}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      />
                    </Field>

                    <Field label="Limite por cliente">
                      <input
                        name="per_customer_limit"
                        type="number"
                        min="1"
                        defaultValue={1}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      />
                    </Field>

                    <Field label="Período por cliente">
                      <input
                        name="per_customer_period_days"
                        type="number"
                        min="1"
                        defaultValue={30}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      />
                    </Field>

                    <Field label="Validade opcional">
                      <input
                        name="valid_until"
                        type="date"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      />
                    </Field>

                    <Field label="Motivo da regra">
                      <input
                        name="reason"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                        placeholder="Ex: aumentar compartilhamento"
                      />
                    </Field>
                  </div>

                  <Field label="Descrição">
                    <textarea
                      name="description"
                      rows={3}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
                      placeholder="Explique a regra de forma simples para o lojista"
                    />
                  </Field>

                  <label className="flex items-center gap-3 text-sm text-white/70">
                    <input name="active" type="checkbox" defaultChecked className="h-4 w-4 rounded border-white/20 bg-white/5" />
                    Regra ativa ao salvar
                  </label>

                  <VenusButton
                    type="submit"
                    variant="solid"
                    className="h-12 px-6 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium bg-[#C9A84C] text-black"
                  >
                    Criar regra
                  </VenusButton>
                </form>
              </Panel>

              <Panel
                title="Regras ativas"
                description="Ative, pause e revise a carga promocional de cada regra sem sair do servidor."
              >
                <div className="space-y-4">
                  {activeRules.length > 0 ? (
                    activeRules.map((rule) => (
                      <RuleCard key={rule.id} slug={slug} rule={rule} automationEvent={recentAutomaticByRule.get(rule.id) || null} />
                    ))
                  ) : (
                    <EmptyState title="Sem regras ativas" description="Crie a primeira regra para liberar benefícios ao cliente." />
                  )}
                </div>
              </Panel>

              <Panel title="Regras inativas" description="Aqui ficam regras pausadas ou expiradas, preservando o histórico.">
                <div className="space-y-4">
                  {inactiveRules.length > 0 ? (
                    inactiveRules.map((rule) => (
                      <RuleCard key={rule.id} slug={slug} rule={rule} automationEvent={recentAutomaticByRule.get(rule.id) || null} />
                    ))
                  ) : (
                    <EmptyState title="Sem regras inativas" description="Quando você pausar uma regra, ela aparece aqui." />
                  )}
                </div>
              </Panel>
            </section>

            <aside className="space-y-6">
              <Panel
                title="Conceder benefício"
                description="Concessão manual para o modo interno. A validação de budget acontece antes de registrar o evento."
              >
                <form action={`/api/org/${slug}/gamification`} method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="grant_benefit" />
                  <input type="hidden" name="redirect_to" value={`/org/${slug}/gamification`} />

                  <Field label="Regra">
                    <select
                      name="rule_id"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      defaultValue={activeRules[0]?.id || ""}
                    >
                      <option value="">Selecione</option>
                      {overview.rules.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Cliente">
                    <input
                      name="customer_key"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      placeholder="Telefone, id ou chave"
                    />
                  </Field>

                  <Field label="Nome do cliente">
                    <input
                      name="customer_label"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      placeholder="Opcional"
                    />
                  </Field>

                  <Field label="Quantidade">
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      placeholder="Usa o padrão da regra se vazio"
                    />
                  </Field>

                  <Field label="Motivo">
                    <input
                      name="reason"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      placeholder="Ex: share confirmado"
                    />
                  </Field>

                  <VenusButton
                    type="submit"
                    variant="solid"
                    className="h-12 px-6 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium bg-white text-black"
                  >
                    Conceder
                  </VenusButton>
                </form>
              </Panel>

              <Panel
                title="Consumir saldo"
                description="Quando o cliente usa o benefício, o saldo é baixado sem debitar o budget de novo."
              >
                <form action={`/api/org/${slug}/gamification`} method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="consume_benefit" />
                  <input type="hidden" name="redirect_to" value={`/org/${slug}/gamification`} />

                  <Field label="Cliente">
                    <input
                      name="customer_key"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Nome do cliente">
                    <input
                      name="customer_label"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Recurso">
                    <select
                      name="resource_type"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      defaultValue="try_on"
                    >
                      {GAMIFICATION_BENEFIT_RESOURCE_TYPES.map((resourceType) => (
                        <option key={resourceType} value={resourceType}>
                          {gamificationResourceLabel(resourceType)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Quantidade">
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      defaultValue={1}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Motivo">
                    <input
                      name="reason"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none"
                      placeholder="Ex: uso confirmado"
                    />
                  </Field>

                  <VenusButton
                    type="submit"
                    variant="outline"
                    className="h-12 px-6 rounded-full border-white/10 text-[10px] uppercase tracking-[0.08em] font-medium"
                  >
                    Consumir
                  </VenusButton>
                </form>
              </Panel>

              <Panel
                title="Budget por recurso"
                description="Saldo promocional consolidado no período atual, calculado a partir dos eventos reais."
              >
                <div className="space-y-3">
                  {GAMIFICATION_BENEFIT_RESOURCE_TYPES.map((resourceType) => {
                    const bucket = overview.budget.by_resource[resourceType];
                    return (
                      <div key={resourceType} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                              {gamificationResourceLabel(resourceType)}
                            </div>
                            <div className="mt-1 text-xs text-white/45">
                              Concedido {formatNumber(bucket.granted)} | Consumido {formatNumber(bucket.consumed)}
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-[#C9A84C]">{formatNumber(bucket.available)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel
                title="Clientes recompensados"
                description="Os clientes mais recentes com saldo promocional acumulado."
              >
                <div className="space-y-3">
                  {overview.recent_customers.length > 0 ? (
                    overview.recent_customers.map((customer) => (
                      <div key={customer.customer_key} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-white">{customer.customer_label || customer.customer_key}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
                              {customer.customer_key}
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-[#C9A84C]">
                            {formatDate(customer.last_event_at)}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {GAMIFICATION_BENEFIT_RESOURCE_TYPES.map((resourceType) => {
                            const resource = customer.resources[resourceType];
                            return (
                              <div key={resourceType} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="text-[9px] uppercase tracking-[0.18em] text-white/35">
                                  {gamificationResourceLabel(resourceType)}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                  {formatNumber(resource.available)}
                                </div>
                                <div className="mt-1 text-[10px] text-white/45">
                                  {formatNumber(resource.granted)} concedido · {formatNumber(resource.consumed)} usado
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="Sem clientes recompensados"
                      description="As primeiras concessões manuais vão aparecer aqui assim que o fluxo for usado."
                    />
                  )}
                </div>
              </Panel>

              <Panel title="Eventos recentes" description="Feed resumido da auditoria promocional e das concessões.">
                <div className="space-y-3">
                  {overview.recent_events.length > 0 ? (
                    overview.recent_events.map((event) => (
                      <div key={event.id} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-white">{event.event_type.replaceAll("_", " ")}</div>
                            <div className="mt-1 text-xs text-white/45">
                              {event.customer_label || event.customer_key || "Sistema"}
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">{event.status}</div>
                        </div>
                        <div className="mt-2 text-xs text-white/50">
                          {event.resource_type ? `${gamificationResourceLabel(event.resource_type)} · ` : ""}
                          {formatNumber(event.amount)}
                          {event.reason ? ` · ${event.reason}` : ""}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="Sem eventos" description="As ações de gamificação aparecerão aqui depois do primeiro envio." />
                  )}
                </div>
              </Panel>
            </aside>
          </div>
        </main>
      </div>
    );
  } catch {
    redirect("/merchant");
  }
}

function RuleCard({
  slug,
  rule,
  automationEvent,
}: {
  slug: string;
  rule: GamificationRuleRecord;
  automationEvent: GamificationEventRecord | null;
}) {
  const orgAction = `/api/org/${slug}/gamification`;
  const redirectTo = `/org/${slug}/gamification`;

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A84C]">
              {gamificationRuleLabel(rule.rule_type)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
              {gamificationTriggerModeLabel(rule.trigger_mode)}
            </span>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneChip(rule.active)}`}>
              {rule.active ? "Ativa" : "Inativa"}
            </span>
          </div>
          <Heading as="h3" className="text-lg tracking-tight">
            {rule.label}
          </Heading>
          <Text className="text-xs text-white/45">
            {gamificationResourceLabel(rule.benefit_resource_type)} · {formatNumber(rule.benefit_amount)} por concessão
          </Text>
          <Text className="text-xs text-white/45">
            {rule.trigger_mode === "automatic"
              ? `Evento: ${gamificationTriggerEventLabel(rule.trigger_event_type)}`
              : "Modo manual"}
          </Text>
          <Text className="text-xs text-white/45">
            Limite cliente: {formatNumber(rule.per_customer_limit)} por {formatNumber(rule.per_customer_period_days)} dias
          </Text>
          <Text className="text-xs text-white/45">
            {rule.valid_until ? `Validade: ${formatDate(rule.valid_until)}` : `Início: ${formatDate(rule.valid_from)}`}
          </Text>
          {rule.trigger_mode === "automatic" ? (
            <Text className="text-xs text-[#C9A84C]">
              Último disparo: {automationEvent?.created_at ? formatDate(automationEvent.created_at) : "sem disparo"}
            </Text>
          ) : null}
          {rule.description ? <Text className="text-xs text-white/55">{rule.description}</Text> : null}
        </div>

        <form action={orgAction} method="post" className="flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="update_rule" />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <input type="hidden" name="rule_id" value={rule.id} />
          <input type="hidden" name="rule_type" value={rule.rule_type} />
          <input type="hidden" name="trigger_mode" value={rule.trigger_mode} />
          <input type="hidden" name="trigger_event_type" value={rule.trigger_event_type || ""} />
          <input type="hidden" name="benefit_resource_type" value={rule.benefit_resource_type} />
          <input type="hidden" name="benefit_amount" value={rule.benefit_amount} />
          <input type="hidden" name="per_customer_limit" value={rule.per_customer_limit} />
          <input type="hidden" name="per_customer_period_days" value={rule.per_customer_period_days} />
          <input type="hidden" name="label" value={rule.label} />
          <input type="hidden" name="description" value={rule.description || ""} />
          <input type="hidden" name="valid_from" value={rule.valid_from || ""} />
          <input type="hidden" name="valid_until" value={rule.valid_until || ""} />
          <input type="hidden" name="reason" value={rule.active ? "Pause rule" : "Resume rule"} />
          <input type="hidden" name="active" value={String(!rule.active)} />

          <VenusButton
            type="submit"
            variant="outline"
            className="h-11 px-4 rounded-full border-white/10 text-[10px] uppercase tracking-[0.08em] font-medium"
          >
            {rule.active ? "Desativar" : "Ativar"}
          </VenusButton>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">{label}</span>
      {children}
    </label>
  );
}

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${
        active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
      <div className="flex items-center gap-2 text-white/80">
        <Gift size={14} className="text-[#C9A84C]" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="mt-1 text-xs text-white/45">{description}</div>
    </div>
  );
}
