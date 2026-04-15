"use client";

import React from "react";
import { ArrowRight, Image as ImageIcon, MessageCircle, Sparkles } from "lucide-react";
import type { AssistedCatalogProductCard } from "@/lib/catalog-query/presentation";

type CatalogAction = {
  label: string;
  href?: string;
  target?: "_blank" | "_self";
  onClick?: () => void;
};

type AssistedProductCardProps = {
  product: AssistedCatalogProductCard;
  primaryAction?: CatalogAction;
  secondaryAction?: CatalogAction;
  className?: string;
};

function ActionButton({
  action,
  variant,
}: {
  action?: CatalogAction;
  variant: "primary" | "secondary";
}) {
  if (!action) return null;

  const baseClass =
    variant === "primary"
      ? "inline-flex min-h-10 items-center justify-center rounded-full border border-[#C9A84C]/22 bg-[#C9A84C] px-4 text-[10px] font-black uppercase tracking-[0.22em] text-black transition-transform active:scale-[0.98]"
      : "inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/78 transition-colors hover:bg-white/[0.08]";

  if (action.href) {
    return (
      <a
        href={action.href}
        target={action.target || "_blank"}
        rel={action.target === "_self" ? undefined : "noopener noreferrer"}
        onClick={action.onClick}
        className={baseClass}
      >
        {action.label}
        {variant === "primary" ? <ArrowRight className="ml-1.5 h-3.5 w-3.5" /> : null}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={baseClass}
    >
      {variant === "secondary" ? <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> : null}
      {action.label}
      {variant === "primary" ? <ArrowRight className="ml-1.5 h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function AssistedProductCard({
  product,
  primaryAction,
  secondaryAction,
  className,
}: AssistedProductCardProps) {
  const hasImage = Boolean(product.imageUrl);

  return (
    <article
      className={[
        "overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_24px_60px_rgba(0,0,0,0.24)]",
        className || "",
      ].join(" ")}
    >
      <div className="grid gap-0 sm:grid-cols-[132px_minmax(0,1fr)]">
        <div className="relative aspect-[4/5] bg-[#0b0b0d] sm:aspect-auto sm:min-h-[180px]">
          {hasImage ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16)_0%,rgba(8,8,10,0.94)_65%)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <ImageIcon className="h-6 w-6 text-white/25" />
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/16 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/72 backdrop-blur">
            {product.sourceLabel}
          </div>
          {product.priceLabel ? (
            <div className="absolute bottom-4 left-4 rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/12 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-[#F4E2A0] backdrop-blur">
              {product.priceLabel}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#C9A84C]">
              {product.brand}
            </p>
            <h3 className="text-[18px] font-semibold leading-tight text-white">
              {product.title}
            </h3>
          </div>

          <p className="text-[13px] leading-relaxed text-white/65">
            {product.justification}
          </p>

          {(product.colors.length > 0 || product.sizes.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {product.colors.slice(0, 4).map((color) => (
                <span
                  key={color}
                  className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/62"
                >
                  {color}
                </span>
              ))}
              {product.sizes.slice(0, 4).map((size) => (
                <span
                  key={size}
                  className="rounded-full border border-[#C9A84C]/18 bg-[#C9A84C]/8 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F4E2A0]"
                >
                  {size}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <ActionButton action={primaryAction} variant="primary" />
            <ActionButton action={secondaryAction} variant="secondary" />
          </div>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/32">
            <Sparkles className="h-3.5 w-3.5 text-[#C9A84C]" />
            <span>Selecionado para a sua leitura</span>
          </div>
        </div>
      </div>
    </article>
  );
}
