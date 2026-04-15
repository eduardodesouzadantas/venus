import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import {
  RESOURCE_CONTROL_FIELD_DEFINITIONS,
  loadAgencyResourceControlRows,
  type AgencyResourceControlResource,
  type AgencyResourceControlRow,
} from "@/lib/agency/resource-control";
import { resolveAgencySession } from "@/lib/agency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const spaceMono = { className: "font-[family-name:var(--font-space-mono)]" };

const themeVars: CSSProperties & Record<string, string> = {
  ["--gold"]: "#C9A84C",
  ["--green"]: "#00ff88",
  ["--red"]: "#ff4444",
  ["--amber"]: "#ffaa00",
  ["--bg"]: "#080c0a",
  ["--bg2"]: "#0f1410",
  ["--bg3"]: "#141a15",
  ["--border"]: "#1e2820",
  ["--text"]: "#e8f0e9",
  ["--muted"]: "#6b7d6c",
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "sem dados";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "sem dados";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "sem base";
  }

  return `${Math.round(value)}%`;
}

function riskTone(risk: AgencyResourceControlRow["risk"] | AgencyResourceControlResource["status"]) {
  if (risk === "no_data") return "var(--muted)";
  if (risk === "critical") return "var(--red)";
  if (risk === "attention") return "var(--amber)";
  return "var(--green)";
}

function riskLabel(risk: AgencyResourceControlRow["risk"] | AgencyResourceControlResource["status"]) {
  if (risk === "no_data") return "sem dados";
  if (risk === "critical") return "critico";
  if (risk === "attention") return "atencao";
  return "normal";
}

function statusTone(status: string | null | undefined, killSwitch: boolean) {
  if (killSwitch || status === "blocked") return "var(--red)";
  if (status === "active") return "var(--green)";
  return "var(--amber)";
}

function statusLabel(status: string | null | undefined, killSwitch: boolean) {
  if (killSwitch) return "kill switch";
  if (status === "active") return "ativo";
  if (status === "blocked") return "bloqueado";
  if (status === "suspended") return "suspenso";
  return "inativo";
}

function resourceFieldNames(resourceType: AgencyResourceControlResource["resource_type"]) {
  const definition = RESOURCE_CONTROL_FIELD_DEFINITIONS.find((item) => item.resourceType === resourceType);
  if (!definition) {
    return null;
  }

  return definition;
}

function fieldValue(value: number | null) {
  return value === null ? "" : String(value);
}

function resourceIcon(resourceType: AgencyResourceControlResource["resource_type"]) {
  if (resourceType === "ai_tokens") return "TOK";
  if (resourceType === "try_on") return "TRY";
  return "MSG";
}

function PanelHeader({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

export default async function AgencyResourceControlPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  try {
    await resolveAgencySession();
  } catch {
    redirect("/login");
  }

  const [rows, params] = await Promise.all([loadAgencyResourceControlRows(), searchParams]);
  const requestedOrgId = firstValue(params.orgId);
  const selected = rows.find((row) => row.id === requestedOrgId) || rows[0] || null;
  const saved = normalize(params.saved);
  const error = normalize(params.error);
  const editingEnabled = process.env.AGENCY_RESOURCE_CONTROL_EDITING_ENABLED !== "false";

  const criticalCount = rows.filter((row) => row.risk === "critical").length;
  const attentionCount = rows.filter((row) => row.risk === "attention").length;
  const normalCount = rows.filter((row) => row.risk === "normal").length;
  const blockedCount = rows.filter((row) => row.kill_switch || row.status === "blocked").length;

  return (
    <main className="min-h-screen bg-[var(--bg)] p-4 text-[var(--text)] sm:p-6" style={themeVars}>
      <section className="mx-auto max-w-[1680px] space-y-5">
        <header className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--bg2)] p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`${spaceMono.className} text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]`}>
              Agency / control
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">
              Painel de controle por loja
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Limites mensais de tokens, try-ons e mensagens com leitura real, risco simples e edicao server-side
              por tenant.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/agency/merchants"
              className="inline-flex min-h-11 items-center justify-center border border-[var(--border)] px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text)] transition hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Ver lojas
            </Link>
            <Link
              href="/agency"
              className="inline-flex min-h-11 items-center justify-center border border-[var(--gold)]/50 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gold)] transition hover:bg-[var(--gold)] hover:text-black"
            >
              Overview
            </Link>
          </div>
        </header>

        <section className="grid gap-[1px] bg-[var(--border)] lg:grid-cols-4">
          <PanelHeader label="Criticas" value={String(criticalCount)} tone="var(--red)" />
          <PanelHeader label="Atencao" value={String(attentionCount)} tone="var(--amber)" />
          <PanelHeader label="Normal" value={String(normalCount)} tone="var(--green)" />
          <PanelHeader label="Bloqueadas" value={String(blockedCount)} tone="var(--red)" />
        </section>

        {saved === "1" ? (
          <div className="border border-[var(--green)]/40 bg-[rgba(0,255,136,0.08)] px-4 py-3 text-sm text-[var(--green)]">
            Limites atualizados com sucesso.
          </div>
        ) : null}

        {error ? (
          <div className="border border-[var(--red)]/40 bg-[rgba(255,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-[1px] bg-[var(--border)] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[var(--bg2)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
              <div>
                <div className={`${spaceMono.className} text-[11px] uppercase tracking-[1px] text-[var(--muted)]`}>
                  Lojas e risco
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Lojas criticas primeiro, depois atencao e entao operacao normal.
                </p>
              </div>
              <div className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--gold)]`}>
                {rows.length} lojas
              </div>
            </div>

            <div className="hidden grid-cols-[1.35fr_0.72fr_0.68fr_0.68fr_0.68fr_0.65fr_0.7fr] gap-[1px] bg-[var(--border)] font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)] xl:grid">
              {["Loja", "Plano", "Tokens", "Try-ons", "Msgs", "Risco", "Detalhe"].map((label) => (
                <div key={label} className="bg-[var(--bg3)] px-4 py-3">
                  {label}
                </div>
              ))}
            </div>

            <div className="divide-y divide-[var(--border)]">
              {rows.length > 0 ? (
                rows.map((row) => {
                  const isSelected = selected?.id === row.id;

                  return (
                    <Link
                      key={row.id}
                      href={`/agency/resource-control?orgId=${encodeURIComponent(row.id)}`}
                      className={[
                        "grid gap-4 px-4 py-4 transition xl:grid-cols-[1.35fr_0.72fr_0.68fr_0.68fr_0.68fr_0.65fr_0.7fr] xl:items-center xl:gap-3",
                        isSelected ? "bg-[rgba(201,168,76,0.08)]" : "bg-[var(--bg2)] hover:bg-[rgba(255,255,255,0.02)]",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: riskTone(row.risk), boxShadow: `0 0 14px ${riskTone(row.risk)}` }}
                          />
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-[var(--text)]">{row.name}</h2>
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                              /{row.slug} · {statusLabel(row.status, row.kill_switch)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--gold)]">
                        {normalize(row.plan_id).toUpperCase() || "SEM PLANO"}
                      </div>

                      <div className="font-mono text-[11px] text-[var(--text)]">
                        {formatPct(row.resources.find((item) => item.resource_type === "ai_tokens")?.usage_pct)}
                      </div>

                      <div className="font-mono text-[11px] text-[var(--text)]">
                        {formatPct(row.resources.find((item) => item.resource_type === "try_on")?.usage_pct)}
                      </div>

                      <div className="font-mono text-[11px] text-[var(--text)]">
                        {formatPct(row.resources.find((item) => item.resource_type === "whatsapp_message")?.usage_pct)}
                      </div>

                      <div
                        className="font-mono text-[11px] uppercase tracking-[0.16em]"
                        style={{ color: riskTone(row.risk) }}
                      >
                        {riskLabel(row.risk)}
                      </div>

                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                        Abrir
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <p className={`${spaceMono.className} text-[11px] uppercase tracking-[0.2em] text-[var(--gold)]`}>
                    0 lojas
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Nenhuma org encontrada ou o Supabase nao respondeu.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[var(--bg2)]">
            {selected ? (
              <div className="space-y-5 p-4">
                <section className="border border-[var(--border)] bg-[var(--bg3)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`${spaceMono.className} text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]`}>
                        Detalhe por loja
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">{selected.name}</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">/{selected.slug}</p>
                    </div>
                    <span
                      className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: riskTone(selected.risk), borderColor: `${riskTone(selected.risk)}33` }}
                    >
                      {riskLabel(selected.risk)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <PanelHeader
                      label="Status operacional"
                      value={statusLabel(selected.status, selected.kill_switch)}
                      tone={statusTone(selected.status, selected.kill_switch)}
                    />
                    <PanelHeader
                      label="Pagamento"
                      value={selected.billing_status_label}
                      tone={selected.billing_blocked ? "var(--red)" : "var(--green)"}
                    />
                    <PanelHeader label="Periodo" value={`${selected.period_start} -> ${selected.period_end}`} tone="var(--gold)" />
                    <PanelHeader
                      label="Margem estimada"
                      value={selected.margin_estimate_cents === null ? "sem base" : formatMoney(selected.margin_estimate_cents)}
                      tone={selected.margin_estimate_cents !== null && selected.margin_estimate_cents < 0 ? "var(--red)" : "var(--green)"}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {selected.resources.map((resource) => (
                      <div key={resource.resource_type} className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
                          {resource.label}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="text-lg font-semibold text-[var(--text)]">{formatPct(resource.usage_pct)}</div>
                          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
                            {resourceIcon(resource.resource_type)}
                          </div>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, resource.usage_pct || 0))}%`,
                              background:
                                resource.status === "critical"
                                  ? "linear-gradient(90deg, var(--red), #7f1d1d)"
                                  : resource.status === "attention"
                                    ? "linear-gradient(90deg, var(--amber), #7a4a00)"
                                    : "linear-gradient(90deg, var(--green), var(--gold))",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <PanelHeader label="Tokens usados" value={formatNumber(selected.usage_month.ai_tokens)} tone="var(--gold)" />
                    <PanelHeader label="Try-ons usados" value={formatNumber(selected.usage_month.tryons)} tone="var(--amber)" />
                    <PanelHeader label="Mensagens usadas" value={formatNumber(selected.usage_month.messages)} tone="var(--green)" />
                  </div>

                  <div className="mt-4 rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
                    <div className={`${spaceMono.className} text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]`}>
                      Alertas
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.alerts.map((alert) => (
                        <span
                          key={alert}
                          className="rounded-full border border-[var(--border)] bg-[var(--bg3)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text)]"
                        >
                          {alert}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="border border-[var(--border)] bg-[var(--bg3)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`${spaceMono.className} text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]`}>
                        Edição de limites
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Atualizar teto mensal e override</h3>
                    </div>
                    <span
                      className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{
                        color: editingEnabled ? "var(--green)" : "var(--amber)",
                        borderColor: editingEnabled ? "rgba(0,255,136,0.35)" : "rgba(255,170,0,0.35)",
                      }}
                    >
                      {editingEnabled ? "edicao ativa" : "edicao desligada"}
                    </span>
                  </div>

                  <form
                    className="mt-4 space-y-4"
                    action={`/api/agency/orgs/${selected.id}/resource-limits`}
                    method="post"
                  >
                    <input type="hidden" name="redirect_to" value={`/agency/resource-control?orgId=${selected.id}`} />
                    <fieldset disabled={!editingEnabled} className="grid gap-3 disabled:opacity-60">
                      {selected.resources.map((resource) => {
                        const fields = resourceFieldNames(resource.resource_type);
                        if (!fields) {
                          return null;
                        }

                        return (
                          <div key={resource.resource_type} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                  {resource.label}
                                </div>
                                <div className="mt-1 text-sm text-[var(--text)]">
                                  limite atual {formatNumber(resource.monthly_limit)} · override {formatNumber(resource.override_limit)}
                                </div>
                              </div>
                              <span
                                className="rounded-full border border-[var(--border)] bg-[var(--bg3)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]"
                              >
                                {resource.limit_source}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="space-y-2">
                                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                  Limite mensal
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  name={fields.monthlyFieldName}
                                  defaultValue={fieldValue(resource.monthly_limit)}
                                  className="h-11 w-full border border-[var(--border)] bg-[var(--bg2)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                                />
                              </label>

                              <label className="space-y-2">
                                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                  Override opcional
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  name={fields.overrideFieldName}
                                  defaultValue={fieldValue(resource.override_limit)}
                                  placeholder="Opcional"
                                  className="h-11 w-full border border-[var(--border)] bg-[var(--bg2)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </fieldset>

                    <label className="block space-y-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Motivo</span>
                      <textarea
                        name="reason"
                        rows={4}
                        placeholder="Ex: loja crescendo acima do previsto, ajuste temporario de campanha"
                        className="w-full border border-[var(--border)] bg-[var(--bg2)] px-3 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={!editingEnabled}
                        className="inline-flex min-h-11 items-center justify-center border border-[var(--gold)]/50 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gold)] transition hover:bg-[var(--gold)] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Salvar limites
                      </button>
                      <p className="text-xs text-[var(--muted)]">
                        O override substitui o teto contratado enquanto estiver definido.
                      </p>
                    </div>
                  </form>
                </section>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <p className={`${spaceMono.className} text-[11px] uppercase tracking-[0.2em] text-[var(--gold)]`}>
                    Sem loja selecionada
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Volte para a lista e escolha uma loja para ver limites e editar o controle.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
