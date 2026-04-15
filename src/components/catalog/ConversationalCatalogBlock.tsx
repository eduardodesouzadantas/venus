"use client";

import React from "react";
import { ArrowRight, BookOpen, Bookmark, MessageCircle, Sparkles } from "lucide-react";
import { AssistedProductCard } from "./AssistedProductCard";
import type { AssistedCatalogProductCard, CatalogAccessCopy } from "@/lib/catalog-query/presentation";

type CatalogAction = {
  label: string;
  href?: string;
  target?: "_blank" | "_self";
  onClick?: () => void;
};

type ConversationalCatalogBlockProps = {
  copy: CatalogAccessCopy;
  products: AssistedCatalogProductCard[];
  reinforcement?: string[];
  catalogAction?: CatalogAction;
  continueAction?: CatalogAction;
  saveAction?: CatalogAction;
  onOpenProduct?: (product: AssistedCatalogProductCard) => void;
  onAskOpinion?: (product: AssistedCatalogProductCard) => void;
  onSaveLook?: () => void;
  className?: string;
};

function ActionButton({
  action,
  variant,
}: {
  action?: CatalogAction;
  variant: "primary" | "secondary" | "ghost";
}) {
  if (!action) return null;

  const baseClass =
    variant === "primary"
      ? "inline-flex min-h-11 items-center justify-center rounded-full border border-[#C9A84C]/22 bg-[#C9A84C] px-4 text-[10px] font-black uppercase tracking-[0.22em] text-black transition-transform active:scale-[0.98]"
      : variant === "secondary"
        ? "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/78 transition-colors hover:bg-white/[0.08]"
        : "inline-flex min-h-11 items-center justify-center rounded-full border border-white/8 bg-transparent px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/56 transition-colors hover:text-white";

  if (action.href) {
    return (
      <a
        href={action.href}
        target={action.target || "_blank"}
        rel={action.target === "_self" ? undefined : "noopener noreferrer"}
        onClick={action.onClick}
        className={baseClass}
      >
        {variant === "primary" ? <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> : null}
        {variant === "ghost" ? <BookOpen className="mr-1.5 h-3.5 w-3.5" /> : null}
        {action.label}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={baseClass}
    >
      {variant === "primary" ? <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> : null}
      {variant === "ghost" ? <Bookmark className="mr-1.5 h-3.5 w-3.5" /> : null}
      {action.label}
    </button>
  );
}

export function ConversationalCatalogBlock({
  copy,
  products,
  reinforcement = [],
  catalogAction,
  continueAction,
  saveAction,
  onOpenProduct,
  onAskOpinion,
  onSaveLook,
  className,
}: ConversationalCatalogBlockProps) {
  return (
    <section
      className={[
        "rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.022)_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-5",
        className || "",
      ].join(" ")}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#C9A84C]">
            <Sparkles className="h-4 w-4" />
            <p className="text-[10px] font-bold uppercase tracking-[0.32em]">{copy.eyebrow}</p>
          </div>
          <h2 className="text-[24px] font-semibold leading-tight text-white sm:text-[28px]">
            {copy.title}
          </h2>
          <p className="max-w-2xl text-[13px] leading-relaxed text-white/62">
            {copy.summary}
          </p>
        </div>

        {reinforcement.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {reinforcement.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#C9A84C]/16 bg-[#C9A84C]/8 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F4E2A0]"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <div className="rounded-[24px] border border-white/5 bg-black/18 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/36">
            Próximo passo
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/74">
            {copy.nextStep}
          </p>
        </div>

        <div className="space-y-3">
          {products.length > 0 ? (
            products.slice(0, 3).map((product, index) => (
              <AssistedProductCard
                key={product.id}
                product={product}
                primaryAction={{
                  label: product.primaryCtaLabel || (index === 0 ? "Ver detalhe" : "Ver opção"),
                  onClick: () => onOpenProduct?.(product),
                }}
                secondaryAction={{
                  label: product.secondaryCtaLabel,
                  onClick: () => onAskOpinion?.(product),
                }}
              />
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/14 p-5 text-center">
              <p className="text-[13px] text-white/60">
                Ainda não há recomendações suficientes para mostrar.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton action={catalogAction} variant="primary" />
          <ActionButton action={continueAction} variant="secondary" />
          <ActionButton action={saveAction || { label: copy.saveLabel, onClick: onSaveLook }} variant="ghost" />
        </div>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/34">
          <MessageCircle className="h-3.5 w-3.5 text-[#C9A84C]" />
          <span>Leitura assistida, sem excesso visual.</span>
        </div>
      </div>
    </section>
  );
}
