"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { GlassContainer } from "@/components/ui/GlassContainer";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

type MerchantProvisionResponse =
  | {
      ok: true;
      user_id: string;
      email: string;
      org_slug: string;
      org_id: string;
      tenant_org_id: string;
      role: string;
      plan_id: string;
      welcome_email?: {
        sent: boolean;
        provider: "resend" | "none";
        message: string;
      };
    }
  | {
      ok?: false;
      error?: string;
      details?: string;
    };

type AgencyVisualMode = "dark" | "light";
type MerchantPlanId = "freemium" | "starter" | "pro";

const PLAN_OPTIONS: Array<{ value: MerchantPlanId; label: string; description: string }> = [
  { value: "freemium", label: "Freemium", description: "15 dias para validar a operação." },
  { value: "starter", label: "Starter", description: "Entrada para operação recorrente." },
  { value: "pro", label: "Pro", description: "Maior volume e operação mais madura." },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateTempPassword() {
  const segment = Math.random().toString(36).slice(2, 7);
  return `venus-${segment}${Date.now().toString(36).slice(-4)}`;
}

export function MerchantProvisionCard({ mode = "dark" }: { mode?: AgencyVisualMode }) {
  const isLight = mode === "light";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generateTempPassword());
  const [planId, setPlanId] = useState<MerchantPlanId>("freemium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MerchantProvisionResponse | null>(null);

  const derivedSlug = useMemo(() => slugify(name), [name]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/auth/merchant-provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password: password.trim(),
            org_slug: (slug || derivedSlug).trim(),
            org_id: (slug || derivedSlug).trim(),
            role: "merchant_owner",
            plan_id: planId,
          }),
        });

      const payload = (await response.json().catch(() => null)) as MerchantProvisionResponse | null;

      if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Não foi possível cadastrar a loja");
      }

      setResult(payload);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Falha ao cadastrar lojista");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassContainer
      id="cadastro-lojista"
      className={`space-y-5 ${
        isLight
          ? "border-black/10 bg-white/80 text-[#141414] shadow-[0_24px_80px_rgba(17,17,17,0.08)]"
          : "border-white/10 bg-white/[0.04] text-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Text className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-[#8F6D10]" : "text-[#D4AF37]"}`}>
            Cadastro de loja
          </Text>
          <Heading as="h2" className="text-xl md:text-2xl tracking-tight">
            Nova loja em funcionamento
          </Heading>
          <Text className={`text-sm max-w-md ${isLight ? "text-black/60" : "text-white/55"}`}>
            Crie a loja, o acesso e deixe o lojista pronto para entrar no painel B2B sem caça ao botão.
          </Text>
        </div>
        <div
          className={`rounded-full px-3 py-2 text-[10px] font-medium tracking-[0.08em] ${
            isLight
              ? "border border-[#8F6D10]/15 bg-[#8F6D10]/10 text-[#8F6D10]"
              : "border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]"
          }`}
        >
          <ShieldCheck className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]" />
          Cadastro real
        </div>
      </div>

      {result?.ok ? (
        <div className={`space-y-4 rounded-[28px] border p-4 ${isLight ? "border-green-500/20 bg-green-500/10" : "border-green-500/20 bg-green-500/10"}`}>
          <div className="flex items-center gap-2 text-green-300">
            <Check className="w-4 h-4" />
            <Text className={`text-sm font-medium ${isLight ? "text-green-950" : "text-green-100"}`}>Loja cadastrada com sucesso</Text>
          </div>
          <div className={`grid gap-3 text-sm sm:grid-cols-2 ${isLight ? "text-[#141414]" : "text-white/80"}`}>
            <InfoRow label="Loja" value={result.org_slug} />
            <InfoRow label="Email" value={result.email} />
            <InfoRow label="Senha inicial" value={password} />
            <InfoRow label="Plano" value={result.plan_id} />
            <InfoRow label="Próximo passo" value="Entrar em /b2b/login" />
            <InfoRow
              label="Email de boas-vindas"
              value={result.welcome_email?.sent ? "Enviado" : result.welcome_email?.message || "Nao configurado"}
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/b2b/login">
              <VenusButton variant="solid" className={isLight ? "bg-black text-white" : "bg-white text-black"}>
                Abrir login da loja
              </VenusButton>
            </Link>
            <VenusButton
              type="button"
              variant="outline"
              className={isLight ? "border-green-600/25 text-green-700" : "border-green-500/30 text-green-200"}
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              Cadastrar outra loja
            </VenusButton>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>Nome da loja</span>
              <input
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Nome da sua loja"
                className={`h-12 w-full rounded-3xl px-4 text-sm outline-none transition-colors placeholder:opacity-50 focus:border-[#D4AF37]/40 ${
                  isLight
                    ? "border border-black/10 bg-white text-[#141414] placeholder:text-black/25"
                    : "border border-white/10 bg-black/40 text-white placeholder:text-white/20"
                }`}
              />
            </label>
            <label className="space-y-2">
              <span className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>Slug da loja</span>
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="sua-loja"
                className={`h-12 w-full rounded-3xl px-4 text-sm outline-none transition-colors placeholder:opacity-50 focus:border-[#D4AF37]/40 ${
                  isLight
                    ? "border border-black/10 bg-white text-[#141414] placeholder:text-black/25"
                    : "border border-white/10 bg-black/40 text-white placeholder:text-white/20"
                }`}
              />
              </label>
          </div>

          <div className="space-y-2">
            <span className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>Plano</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLAN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPlanId(option.value)}
                  className={`rounded-[28px] border px-4 py-4 text-left transition-colors ${
                    planId === option.value
                      ? isLight
                        ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#141414]"
                        : "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-white"
                      : isLight
                        ? "border-black/10 bg-white text-[#141414]"
                        : "border-white/10 bg-black/40 text-white"
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className={`mt-1 text-[11px] ${isLight ? "text-black/45" : "text-white/45"}`}>{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>Email do lojista</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="lojista@loja.com"
                className={`h-12 w-full rounded-3xl px-4 text-sm outline-none transition-colors placeholder:opacity-50 focus:border-[#D4AF37]/40 ${
                  isLight
                    ? "border border-black/10 bg-white text-[#141414] placeholder:text-black/25"
                    : "border border-white/10 bg-black/40 text-white placeholder:text-white/20"
                }`}
              />
            </label>
            <label className="space-y-2">
              <span className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/45" : "text-white/35"}`}>Senha inicial</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`h-12 w-full rounded-3xl px-4 text-sm outline-none transition-colors placeholder:opacity-50 focus:border-[#D4AF37]/40 ${
                  isLight
                    ? "border border-black/10 bg-white text-[#141414] placeholder:text-black/25"
                    : "border border-white/10 bg-black/40 text-white placeholder:text-white/20"
                }`}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <VenusButton
              type="button"
              variant="outline"
              className={isLight ? "border-black/10 text-black/70" : "border-white/10 text-white/70"}
              onClick={() => setPassword(generateTempPassword())}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Gerar senha
            </VenusButton>
            <VenusButton
              type="submit"
              variant="solid"
              disabled={isSubmitting || !name.trim() || !email.trim() || !(slug || derivedSlug).trim()}
              className={isLight ? "bg-[#D4AF37] text-black" : "bg-[#D4AF37] text-black"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cadastrando
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar lojista
                </>
              )}
            </VenusButton>
          </div>

          <Text className={`text-[10px] font-medium tracking-[0.08em] ${isLight ? "text-black/40" : "text-white/35"}`}>
            Isso cria o acesso e sincroniza a loja canônica para o painel B2B.
          </Text>
        </form>
      )}
    </GlassContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
      <Text className="text-[10px] font-medium tracking-[0.08em] text-white/35">{label}</Text>
      <Text className="mt-1 break-all text-sm text-white/90">{value}</Text>
      </div>
  );
}


