"use client";

import React from "react";
import { ArrowRight, Image as ImageIcon, Sparkles } from "lucide-react";
import type { AssistedLookStripItem } from "@/lib/catalog-query/presentation";

type AssistedLookStripProps = {
  looks: AssistedLookStripItem[];
  title?: string;
  summary?: string;
  onSelectLook?: (look: AssistedLookStripItem) => void;
  className?: string;
};

function LookActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/76 transition-colors hover:bg-white/[0.08]"
    >
      {label}
      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
    </button>
  );
}

export function AssistedLookStrip({
  looks,
  title = "Variações de look",
  summary = "Composição simples com peça principal e complementares, sem excesso visual.",
  onSelectLook,
  className,
}: AssistedLookStripProps) {
  if (!looks || looks.length === 0) {
    return (
      <div className={[
        "rounded-[28px] border border-white/5 bg-white/[0.03] p-5",
        className || "",
      ].join(" ")}>
        <div className="flex items-center gap-2 text-[#C9A84C]">
          <Sparkles className="h-4 w-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Look assistido</p>
        </div>
        <p className="mt-3 text-sm text-white/60">Ainda não há variações suficientes para mostrar agora.</p>
      </div>
    );
  }

  return (
    <section className={[
      "space-y-4",
      className || "",
    ].join(" ")}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[#C9A84C]">
          <Sparkles className="h-4 w-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]">{title}</p>
        </div>
        <p className="text-[13px] leading-relaxed text-white/58">{summary}</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 pr-2 snap-x snap-mandatory">
        {looks.map((look) => (
          <article
            key={look.id}
            className="min-w-[82vw] max-w-[360px] snap-start overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:min-w-[320px]"
          >
            <div className="grid gap-0 sm:grid-cols-[110px_minmax(0,1fr)]">
              <div className="relative aspect-[4/5] bg-[#0b0b0d] sm:aspect-auto sm:min-h-[170px]">
                {look.imageUrl ? (
                  <img
                    src={look.imageUrl}
                    alt={look.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.12)_0%,rgba(8,8,10,0.94)_65%)]">
                    <ImageIcon className="h-7 w-7 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.22em] text-white/72 backdrop-blur">
                  {look.typeLabel}
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-[9px] font-medium uppercase tracking-[0.18em] text-white/56">
                  {look.detailLine}
                </div>
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                <h3 className="text-[17px] font-semibold leading-tight text-white">
                  {look.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-white/62">
                  {look.description}
                </p>

                {look.supportingPieces.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {look.supportingPieces.slice(0, 3).map((piece) => (
                      <span
                        key={piece}
                        className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60"
                      >
                        {piece}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <LookActionButton
                    label={look.ctaLabel}
                    onClick={() => onSelectLook?.(look)}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
