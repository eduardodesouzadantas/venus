"use client";

import React from "react";

export interface PaletteSwatch {
  hex: string;
  name: string;
  reason?: string;
  tier?: "base" | "accent" | "avoid";
}

interface PaletteSectionProps {
  title: string;
  swatches: PaletteSwatch[];
  hint?: string;
  layout?: "grid" | "inline";
}

function safeHex(value: string | undefined, fallback = "#C9A84C"): string {
  if (!value) return fallback;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
}

function PaletteSwatchItem({ swatch }: { swatch: PaletteSwatch }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-10 w-10 rounded-full border border-white/10 shadow-inner"
        style={{ backgroundColor: safeHex(swatch.hex) }}
      />
      <span className="text-[8px] uppercase tracking-wide text-white/50 truncate max-w-[60px] text-center">
        {swatch.name}
      </span>
    </div>
  );
}

export function PaletteSection({ title, swatches, hint, layout = "grid" }: PaletteSectionProps) {
  if (swatches.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">{title}</p>
        {hint && <p className="text-[10px] text-white/40">• {hint}</p>}
      </div>
      <div className={layout === "inline" ? "flex gap-3" : "grid grid-cols-2 gap-2"}>
        {swatches.slice(0, 5).map((swatch, index) => (
          <PaletteSwatchItem key={index} swatch={swatch} />
        ))}
      </div>
    </div>
  );
}

interface VenusPaletteProps {
  recommended?: PaletteSwatch[];
  accents?: PaletteSwatch[];
  avoid?: PaletteSwatch[];
  contrast?: string;
  metal?: string;
  confidence?: string;
}

export function VenusPalette({
  recommended = [],
  accents = [],
  avoid = [],
  contrast,
  metal,
  confidence,
}: VenusPaletteProps) {
  const hasSwatches = recommended.length > 0 || accents.length > 0 || avoid.length > 0;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]">SUA PALETA VENUS</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {hasSwatches ? (
          <>
            {recommended.length > 0 && (
              <PaletteSection title="CORES BASE" swatches={recommended} layout="inline" />
            )}

            {accents.length > 0 && (
              <PaletteSection title="ACENTOS" swatches={accents} layout="inline" />
            )}

            {avoid.length > 0 && (
              <PaletteSection title="USAR COM CAUTELA" swatches={avoid} layout="inline" />
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center text-[12px] leading-relaxed text-white/55">
            A paleta será refinada com mais dados da sua leitura visual.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        {contrast && (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider text-white/70">
            Contraste {contrast}
          </span>
        )}
        {metal && (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider text-white/70">
            Metal {metal}
          </span>
        )}
        {confidence && (
          <span className="rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/8 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider text-[#C9A84C]">
            {confidence}
          </span>
        )}
      </div>
    </div>
  );
}
