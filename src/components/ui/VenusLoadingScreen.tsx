"use client";

import { cn } from "@/lib/utils";

type VenusLoadingScreenProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function VenusLoadingScreen({
  eyebrow = "Consultoria premium",
  title = "A Venus está preparando sua leitura",
  subtitle = "Abrindo a experiência da loja com segurança e um shell visual premium.",
  compact = false,
}: VenusLoadingScreenProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-[#C9A84C]/10 blur-[110px]" />
        <div className="absolute right-[-14%] top-[14%] h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute bottom-[-12%] left-[14%] h-80 w-80 rounded-full bg-[#C9A84C]/6 blur-[140px]" />
      </div>

      <div
        className={cn(
          "relative z-10 w-full max-w-[560px] rounded-[34px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl",
          compact ? "py-5" : "sm:p-8"
        )}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
        </div>

        <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.38em] text-[#C9A84C]">{eyebrow}</p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[2.35rem]">{title}</h1>
        <p className="mt-4 text-[15px] leading-7 text-white/70 sm:text-[16px]">{subtitle}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/38">
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">Brand shell</span>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">Hydrating safely</span>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">Mobile-first</span>
        </div>
      </div>
    </div>
  );
}
