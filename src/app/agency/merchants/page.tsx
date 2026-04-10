import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { CopyTextButton } from "@/components/agency/CopyTextButton";
import { listAgencyOrgRows } from "@/lib/agency";

export const dynamic = "force-dynamic";

const themeVars = {
  "--gold": "#C9A84C",
  "--green": "#00ff88",
  "--red": "#ff4444",
  "--amber": "#ffaa00",
  "--bg": "#080c0a",
  "--bg2": "#0f1410",
  "--bg3": "#141a15",
  "--border": "#1e2820",
  "--text": "#e8f0e9",
  "--muted": "#6b7d6c",
} as CSSProperties & Record<string, string>;

const PUBLIC_BASE_URL = "https://venus-engine.vercel.app";

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "sem dados";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function statusLabel(row: { status: string; kill_switch: boolean }) {
  if (row.kill_switch) return "bloqueado";
  if (row.status === "active") return "ativo";
  if (row.status === "blocked") return "bloqueado";
  return "inativo";
}

function statusTone(row: { status: string; kill_switch: boolean }) {
  if (row.kill_switch || row.status === "blocked") return "var(--red)";
  if (row.status === "active") return "var(--green)";
  return "var(--amber)";
}

function planBadge(planId: string | null | undefined) {
  const plan = (planId || "sem-plano").toUpperCase();
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 font-mono text-[10px] tracking-[0.16em] text-[var(--gold)]">
      {plan}
    </span>
  );
}

function ActionShell({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">{children}</div>;
}

export default async function AgencyMerchantsPage() {
  const rows = await listAgencyOrgRows().catch(() => []);

  return (
    <main className="min-h-screen bg-[var(--bg)] p-4 text-[var(--text)] sm:p-6" style={themeVars}>
      <section className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--bg2)] p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">Agency / merchants</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Lojas provisionadas</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Controle operacional de todas as organizações com semáforos, métricas e ações de administração.
            </p>
          </div>
          <Link
            href="/agency/merchants/new"
            className="inline-flex min-h-11 items-center justify-center border border-[var(--gold)]/50 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gold)] transition hover:bg-[var(--gold)] hover:text-black"
          >
            Nova loja
          </Link>
        </header>

        <section className="border border-[var(--border)] bg-[var(--border)]">
          <div className="hidden grid-cols-[1.2fr_0.85fr_1.45fr_0.8fr_0.8fr_0.8fr_1fr_1.8fr] gap-[1px] bg-[var(--border)] font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)] xl:grid">
            {["Loja", "Slug", "Link exclusivo", "Plano", "Status", "Leads", "Try-ons", "Ações"].map((label) => (
              <div key={label} className="bg-[var(--bg3)] px-4 py-3">
                {label}
              </div>
            ))}
          </div>

          <div className="divide-y divide-[var(--border)] bg-[var(--bg2)]">
            {rows.length > 0 ? (
              rows.map((row) => {
                const exclusiveLink = `${PUBLIC_BASE_URL}/?org=${row.slug}`;

                return (
                  <article
                    key={row.id}
                    className="grid gap-4 px-4 py-4 xl:grid-cols-[1.2fr_0.85fr_1.45fr_0.8fr_0.8fr_0.8fr_1fr_1.8fr] xl:items-center xl:gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: statusTone(row), boxShadow: `0 0 14px ${statusTone(row)}` }}
                        />
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-[var(--text)]">{row.name || row.slug}</h2>
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">criada {formatDate(row.created_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="font-mono text-[11px] text-[var(--muted)] xl:truncate">/{row.slug}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[11px] text-[var(--text)]">{exclusiveLink}</span>
                        <CopyTextButton value={exclusiveLink} />
                      </div>
                    </div>
                    <div>{planBadge(row.plan_id)}</div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: statusTone(row) }}>
                      {statusLabel(row)}
                    </div>
                    <div className="font-mono text-lg font-bold text-[var(--text)]">{formatCount(row.total_leads)}</div>
                    <div className="font-mono text-lg font-bold text-[var(--text)]">{formatCount(row.total_saved_results)}</div>

                    <ActionShell>
                      <Link
                        className="border border-[var(--green)]/35 px-3 py-2 text-[var(--green)] hover:bg-[var(--green)] hover:text-black"
                        href={`/org/${row.slug}/dashboard`}
                      >
                        Entrar na loja
                      </Link>
                      <Link
                        className="border border-[var(--gold)]/45 px-3 py-2 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black"
                        href={`/agency/merchants/${row.id}`}
                      >
                        Editar
                      </Link>
                      <form action={`/api/admin/orgs/${row.id}`} method="post">
                        <input type="hidden" name="action" value={row.status === "active" ? "suspend" : "activate"} />
                        <input type="hidden" name="redirect_to" value="/agency/merchants" />
                        <button className="border border-[var(--amber)]/45 px-3 py-2 text-[var(--amber)] hover:bg-[var(--amber)] hover:text-black" type="submit">
                          {row.status === "active" ? "Suspender" : "Ativar"}
                        </button>
                      </form>
                      <form action={`/api/admin/orgs/${row.id}`} method="post">
                        <input type="hidden" name="action" value="soft_delete" />
                        <input type="hidden" name="redirect_to" value="/agency/merchants" />
                        <button className="border border-[var(--red)]/35 px-3 py-2 text-[var(--red)] hover:bg-[var(--red)] hover:text-black" type="submit">
                          Excluir
                        </button>
                      </form>
                    </ActionShell>
                  </article>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--gold)]">0 lojas</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Nenhuma organização encontrada ou Supabase indisponível.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
