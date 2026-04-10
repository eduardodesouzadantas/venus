"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type ProvisionResult = {
  ok?: boolean;
  error?: string;
  details?: string;
  org_slug?: string;
  tenant_org_id?: string;
  plan_id?: string;
  email?: string;
};

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
} as React.CSSProperties;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generatePassword() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `Venus@${suffix}26!`;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "min-h-12 w-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--gold)]";

export default function NewAgencyMerchantPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [planId, setPlanId] = useState("freemium");
  const [email, setEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [tempPassword, setTempPassword] = useState("");

  function handleNameChange(nextName: string) {
    setName(nextName);
    setSlug((currentSlug) => (currentSlug ? currentSlug : slugify(nextName)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    const password = generatePassword();
    setTempPassword(password);

    try {
      const normalizedSlug = slugify(slug || name);
      const isBranchProvision = Boolean(branchName.trim());
      const response = await fetch("/api/auth/merchant-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          org_slug: normalizedSlug,
          role: "merchant_owner",
          name,
          plan_id: planId,
          whatsapp_number: whatsappNumber,
          branch_name: name,
          provision_mode: isBranchProvision ? "branch" : "independent",
          branch_mode: isBranchProvision ? "new" : "existing",
          merchant_group_name: isBranchProvision ? branchName : undefined,
          agency_org_id: isBranchProvision ? undefined : undefined,
        }),
      });

      const payload = (await response.json()) as ProvisionResult;
      setResult(payload);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Falha ao provisionar loja" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const resolvedSlug = slugify(slug || name);

  return (
    <main className="min-h-screen bg-[var(--bg)] p-4 text-[var(--text)] sm:p-6" style={themeVars}>
      <section className="mx-auto grid max-w-[1200px] gap-[1px] bg-[var(--border)] lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="space-y-5 bg-[var(--bg2)] p-5 sm:p-7">
          <div className="border-b border-[var(--border)] pb-5">
            <Link href="/agency/merchants" className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gold)]">
              Voltar para lojas
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">Provisionar nova loja</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cria usuario merchant, org, membership e tenant core pelo endpoint existente.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da loja">
              <input className={inputClass} required value={name} onChange={(event) => handleNameChange(event.target.value)} placeholder="Ex: Venus Store Ipanema" />
            </Field>

            <Field label="Slug" hint={`Preview: /org/${resolvedSlug || "slug"}/dashboard`}>
              <input className={`${inputClass} font-mono`} required value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="venus-store-ipanema" />
            </Field>

            <Field label="Plano">
              <select className={`${inputClass} font-mono uppercase`} value={planId} onChange={(event) => setPlanId(event.target.value)}>
                <option value="freemium">Freemium</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>

            <Field label="Email do lojista">
              <input className={inputClass} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="lojista@marca.com" />
            </Field>

            <Field label="WhatsApp da loja">
              <input className={`${inputClass} font-mono`} value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="+55 11 99999-9999" />
            </Field>

            <Field label="Grupo / filial opcional">
              <input className={inputClass} value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Shopping, franquia ou grupo" />
            </Field>
          </div>

          <button
            className="min-h-12 w-full border border-[var(--gold)]/60 bg-[var(--gold)] px-5 font-mono text-[11px] uppercase tracking-[0.2em] text-black transition hover:bg-transparent hover:text-[var(--gold)] disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting || !resolvedSlug}
            type="submit"
          >
            {isSubmitting ? "Provisionando..." : "Criar loja"}
          </button>

          {result ? (
            <div className={`border p-4 ${result.ok ? "border-[var(--green)]/40 bg-[rgba(0,255,136,0.06)]" : "border-[var(--red)]/40 bg-[rgba(255,68,68,0.06)]"}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: result.ok ? "var(--green)" : "var(--red)" }}>
                {result.ok ? "Loja provisionada" : "Falha no provisionamento"}
              </p>
              <pre className="mt-3 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--text)]">
                {JSON.stringify({ ...result, temp_password: result.ok ? tempPassword : undefined }, null, 2)}
              </pre>
            </div>
          ) : null}
        </form>

        <aside className="bg-[var(--bg3)] p-5 sm:p-7">
          <div className="sticky top-5 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">Mission packet</p>
            <div className="border border-[var(--border)] bg-[var(--bg)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gold)]">Slug</p>
              <p className="mt-2 break-all font-mono text-lg text-[var(--text)]">{resolvedSlug || "aguardando-nome"}</p>
            </div>
            <div className="grid grid-cols-2 gap-[1px] bg-[var(--border)]">
              <div className="bg-[var(--bg)] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">Plano</p>
                <p className="mt-2 font-mono text-lg uppercase text-[var(--green)]">{planId}</p>
              </div>
              <div className="bg-[var(--bg)] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">Status</p>
                <p className="mt-2 font-mono text-lg uppercase text-[var(--amber)]">draft</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-[var(--muted)]">
              A senha temporaria e gerada no envio porque o endpoint atual exige password. O email de boas-vindas continua sendo disparado pelo backend.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
