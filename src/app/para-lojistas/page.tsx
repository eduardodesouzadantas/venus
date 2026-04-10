import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { ArrowRight, Crown, MessagesSquare, ScanSearch, Sparkles } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isTenantActive, resolveTenantContext, normalizeTenantSlug } from "@/lib/tenant/core";
import { VenusAvatar } from "@/components/venus/VenusAvatar";

const pillars = [
  {
    icon: ScanSearch,
    title: "Lê a essência",
    text: "Foto, intenção e sinais visuais entram primeiro. Nada de questionário solto.",
  },
  {
    icon: Sparkles,
    title: "Cruza o catálogo",
    text: "A curadoria encontra as peças certas e explica por que elas funcionam.",
  },
  {
    icon: MessagesSquare,
    title: "Fecha no WhatsApp",
    text: "A leitura vira conversa, prova social e próxima ação real com a loja.",
  },
];

const proofTags = ["Foto + corpo + paleta", "Catálogo real da loja", "Share pronto para postar", "WhatsApp que converte"];

const steps = [
  {
    number: "01",
    title: "Entrada consultiva",
    text: "A Venus calibra a direção visual antes de sugerir qualquer look.",
  },
  {
    number: "02",
    title: "Curadoria precisa",
    text: "O app cruza perfil, proporção e catálogo para montar uma escolha coerente.",
  },
  {
    number: "03",
    title: "Desejo que retroalimenta",
    text: "A imagem final é compartilhável, marca a loja e puxa novos testes.",
  },
];

export default async function SplashPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const requestedOrg = normalizeTenantSlug(
    typeof resolved.org === "string" ? resolved.org : Array.isArray(resolved.org) ? resolved.org[0] || "" : ""
  );

  if (requestedOrg) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const context = resolveTenantContext(user);
      if (context.role && isAgencyRole(context.role)) {
        redirect("/agency");
      }

      const tenant = await fetchTenantBySlug(admin, requestedOrg);
      if (
        tenant.org &&
        isTenantActive(tenant.org) &&
        (context.orgSlug === tenant.org.slug || context.orgId === tenant.org.id)
      ) {
        redirect(`/org/${tenant.org.slug}/dashboard`);
      }

      redirect("/merchant");
    }

    const tenant = await fetchTenantBySlug(admin, requestedOrg);
    if (tenant.org && isTenantActive(tenant.org)) {
      redirect(`/onboarding/intent?org=${tenant.org.slug}`);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04070A] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(224,228,235,0.11),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(212,175,55,0.04),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-14 pt-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-sm font-semibold text-[#D4AF37]">
              V
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#D4AF37]">Venus Engine</div>
            </div>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white/45 sm:block">
            Leitura consultiva • Catálogo real • Conversão viva
          </div>
        </header>

        <main className="grid flex-1 gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-14">
          <section className="max-w-2xl space-y-6 sm:space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/6 px-4 py-2">
              <Crown className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#D4AF37]">Consultoria visual premium</span>
            </div>

            <div className="flex flex-col items-start gap-4 py-2 sm:flex-row sm:items-center sm:gap-5">
              <VenusAvatar size={80} animated />
              <div className="space-y-1">
                <div className="font-serif text-[2.4rem] italic leading-none tracking-[0.2em] text-[#D4AF37] sm:text-[3rem]">
                  VENUS
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">sua personal stylist</div>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-[12ch] font-serif text-[2.85rem] leading-[0.92] tracking-[-0.04em] text-white sm:text-[4.35rem] lg:text-[4.9rem]">
                A Venus entende sua essência.
              </h1>
              <p className="max-w-2xl text-[16px] leading-8 text-white/68 sm:text-[17px]">
                Foto, corpo, paleta e catálogo real. A leitura vira look certo, imagem desejável e WhatsApp pronto para converter.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/splash"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#F1D77A_0%,#D4AF37_100%)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0A0A0A] shadow-[0_18px_40px_rgba(212,175,55,0.18)] transition-transform active:scale-[0.98] sm:px-8"
              >
                COMEÇAR LEITURA →
              </Link>
            </div>

            <div className="hidden flex-wrap gap-2 sm:flex">
              {proofTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-[8px] font-bold uppercase tracking-[0.26em] text-white/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="relative">
            <div className="absolute -left-8 top-6 h-24 w-24 rounded-full bg-[#D4AF37]/10 blur-3xl sm:h-28 sm:w-28" />
            <div className="absolute right-2 top-10 h-28 w-28 rounded-full bg-white/6 blur-3xl sm:h-36 sm:w-36" />

            <div className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:rounded-[36px] sm:p-5">
              <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4">
                <div className="space-y-1">
                  <div className="text-[9px] font-bold uppercase tracking-[0.34em] text-[#D4AF37]">Motor de desejo</div>
                  <div className="text-[15px] font-semibold text-white">A porta de entrada da loja inteira</div>
                </div>
                <div className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.24em] text-[#D4AF37]">
                  Máquina viva
                </div>
              </div>

              <div className="overflow-hidden rounded-[26px] border border-white/8 bg-black/40">
                <img
                  src="/hero-v2.png"
                  alt="Venus editorial preview"
                  className="h-[300px] w-full object-cover object-top sm:h-[520px]"
                />
              </div>

              <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
                {steps.map((step) => (
                  <div key={step.number} className="rounded-[22px] border border-white/6 bg-black/22 p-3 sm:rounded-[24px] sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#D4AF37]">{step.number}</span>
                      <span className="text-[8px] uppercase tracking-[0.24em] text-white/30">
                        {step.number === "01" ? "Entende" : step.number === "02" ? "Curadoria" : "Atrai"}
                      </span>
                    </div>
                    <div className="mt-2 text-[14px] font-semibold text-white">{step.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-white/62 sm:text-[13px] sm:leading-6">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <section className="grid gap-4 pb-6 lg:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <div key={pillar.title} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/8">
                    <Icon className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/32">High ticket experience</div>
                </div>
                <div className="mt-4 text-[18px] font-semibold text-white">{pillar.title}</div>
                <p className="mt-2 max-w-md text-[14px] leading-7 text-white/62">{pillar.text}</p>
              </div>
            );
          })}
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/6 pt-5 text-[9px] uppercase tracking-[0.34em] text-white/28 sm:flex-row sm:items-center sm:justify-between">
          <span>Venus Engine • consultoria visual para catálogo real</span>
          <span>Foto + essência + look certo + conversão</span>
        </footer>
      </div>
    </div>
  );
}
