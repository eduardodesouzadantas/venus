"use client";

import * as React from "react";
import { VenusButton } from "@/components/ui/VenusButton";
import { VenusAvatar } from "@/components/venus/VenusAvatar";
import { cn } from "@/lib/utils";
import type { OnboardingIntroCopy } from "@/lib/onboarding/wow-surface";
import type { VenusTenantBrand } from "@/lib/venus/brand";

function brandInitial(brand: VenusTenantBrand) {
  return (brand.displayName || "S").trim().charAt(0).toUpperCase() || "S";
}

export function TenantBrandHeader({
  brand,
  compact = false,
}: {
  brand: VenusTenantBrand;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.045] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl",
        compact ? "px-3 py-2.5" : ""
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(201,168,76,0.24)_0%,rgba(255,255,255,0.04)_100%)]">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.displayName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[14px] font-semibold uppercase tracking-[0.22em] text-[#F5E2A0]">
            {brandInitial(brand)}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#C9A84C]">Sua loja</p>
        <p className="truncate text-[14px] font-semibold text-white">{brand.displayName}</p>
      </div>
    </div>
  );
}

export function BrandIntroScreen({
  brand,
  copy,
  onStart,
}: {
  brand: VenusTenantBrand;
  copy: OnboardingIntroCopy;
  onStart: () => void;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#090909] px-5 py-6 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-72 w-72 rounded-full bg-[#C9A84C]/10 blur-[110px]" />
        <div className="absolute right-[-14%] top-[14%] h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute bottom-[-12%] left-[14%] h-80 w-80 rounded-full bg-[#C9A84C]/6 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-between gap-6">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <VenusAvatar size={46} animated />
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#C9A84C]">Venus</p>
                <p className="text-[11px] text-white/42">Consultoria premium da loja</p>
              </div>
            </div>

            <div className="hidden sm:block">
              <TenantBrandHeader brand={brand} compact />
            </div>
          </div>

          <div className="space-y-4 rounded-[34px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
            <div className="sm:hidden">
              <TenantBrandHeader brand={brand} />
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#C9A84C]">{copy.eyebrow}</p>
              <h1 className="max-w-[12ch] text-[2.35rem] font-semibold leading-[0.94] tracking-[-0.05em] sm:text-[3.1rem]">
                {copy.headline}
              </h1>
              <p className="max-w-[34ch] text-[15px] leading-7 text-white/70 sm:text-[16px]">{copy.subheadline}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <VenusButton type="button" variant="solid" onClick={onStart} className="w-full sm:w-auto sm:min-w-[180px]">
                {copy.primaryCta}
              </VenusButton>
              <p className="text-[12px] leading-6 text-white/52 sm:pl-2">{copy.supportLine}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 text-[13px] leading-6 text-white/58 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <p>A loja entra primeiro. A conversa vem depois.</p>
        </div>
      </div>
    </div>
  );
}

export function PhotoUploadCTA({
  label,
  helperText,
  onPrimary,
  secondaryLabel,
  onSecondary,
  disabled,
}: {
  label: string;
  helperText: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.045] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#C9A84C]">Enviar foto</p>
      <p className="mt-2 text-[15px] leading-7 text-white/88">{helperText}</p>

      <div className="mt-4 flex flex-col gap-3">
        <VenusButton type="button" variant="solid" disabled={disabled} onClick={onPrimary} className="w-full">
          {label}
        </VenusButton>

        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            disabled={disabled}
            className="inline-flex w-full items-center justify-center rounded-full border border-white/8 bg-transparent px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/52 transition-colors hover:border-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PublicOnboardingFrame({
  started,
  brand,
  copy,
  onStart,
  children,
}: {
  started: boolean;
  brand: VenusTenantBrand;
  copy: OnboardingIntroCopy;
  onStart: () => void;
  children: React.ReactNode;
}) {
  return started ? <>{children}</> : <BrandIntroScreen brand={brand} copy={copy} onStart={onStart} />;
}
