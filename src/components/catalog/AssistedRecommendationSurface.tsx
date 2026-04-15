"use client";

import React from "react";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import { AssistedLookStrip } from "./AssistedLookStrip";
import { ConversationalCatalogBlock } from "./ConversationalCatalogBlock";
import type { AssistedCatalogProductCard, AssistedLookStripItem, AssistedRecommendationSurface as AssistedRecommendationSurfaceModel, CatalogAccessCopy } from "@/lib/catalog-query/presentation";

type CatalogAction = {
  label: string;
  href?: string;
  target?: "_blank" | "_self";
  onClick?: () => void;
};

type AssistedRecommendationSurfaceProps = {
  surface: AssistedRecommendationSurfaceModel;
  catalogAction?: CatalogAction;
  continueAction?: CatalogAction;
  saveAction?: CatalogAction;
  onOpenProduct?: (product: AssistedCatalogProductCard) => void;
  onAskOpinion?: (product: AssistedCatalogProductCard) => void;
  onSaveLook?: () => void;
  onSelectLook?: (look: AssistedLookStripItem) => void;
  onMoreOptions?: () => void;
  onTalkToVenus?: () => void;
  className?: string;
};

function SurfaceActionButton({
  label,
  onClick,
  href,
  target,
  variant,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  target?: "_blank" | "_self";
  variant: "primary" | "secondary" | "ghost";
}) {
  const baseClass =
    variant === "primary"
      ? "inline-flex min-h-10 items-center justify-center rounded-full border border-[#C9A84C]/22 bg-[#C9A84C] px-4 text-[10px] font-black uppercase tracking-[0.22em] text-black transition-transform active:scale-[0.98]"
      : variant === "secondary"
        ? "inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/78 transition-colors hover:bg-white/[0.08]"
        : "inline-flex min-h-10 items-center justify-center rounded-full border border-white/8 bg-transparent px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/58 transition-colors hover:text-white";

  if (href) {
    return (
      <a
        href={href}
        target={target || "_blank"}
        rel={target === "_self" ? undefined : "noopener noreferrer"}
        onClick={onClick}
        className={baseClass}
      >
        {variant === "primary" ? <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> : null}
        {variant === "ghost" ? <Sparkles className="mr-1.5 h-3.5 w-3.5" /> : null}
        {label}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {variant === "primary" ? <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> : null}
      {variant === "ghost" ? <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

export function AssistedRecommendationSurface({
  surface,
  catalogAction,
  continueAction,
  saveAction,
  onOpenProduct,
  onAskOpinion,
  onSaveLook,
  onSelectLook,
  onMoreOptions,
  onTalkToVenus,
  className,
}: AssistedRecommendationSurfaceProps) {
  const hasRecommendations = surface.products.length > 0 || surface.looks.length > 0;

  if (!hasRecommendations) {
    return (
      <section
        className={[
          "rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-6",
          className || "",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 text-[#C9A84C]">
          <Sparkles className="h-4 w-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.32em]">{surface.copy.eyebrow}</p>
        </div>
        <div className="mt-3 rounded-[24px] border border-dashed border-white/10 bg-black/14 p-5 text-center">
          <p className="text-[13px] font-medium text-white/74">{surface.emptyState.title}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/52">{surface.emptyState.summary}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={[
        "space-y-4",
        className || "",
      ].join(" ")}
    >
      <div className="flex flex-wrap gap-2">
        <SurfaceActionButton
          label={surface.actions.moreOptionsLabel}
          onClick={onMoreOptions}
          variant="secondary"
        />
        <SurfaceActionButton
          label={surface.actions.talkToVenusLabel}
          onClick={onTalkToVenus}
          variant="ghost"
        />
      </div>

      {surface.reinforcement.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {surface.reinforcement.slice(0, 3).map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#C9A84C]/16 bg-[#C9A84C]/8 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F4E2A0]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <ConversationalCatalogBlock
        copy={surface.copy as CatalogAccessCopy}
        products={surface.products}
        reinforcement={[]}
        catalogAction={catalogAction}
        continueAction={continueAction}
        saveAction={saveAction}
        onOpenProduct={onOpenProduct}
        onAskOpinion={onAskOpinion}
        onSaveLook={onSaveLook}
      />

      {surface.looks.length > 0 ? (
        <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-4 sm:p-5">
          <AssistedLookStrip
            looks={surface.looks}
            onSelectLook={onSelectLook}
          />
        </div>
      ) : null}
    </section>
  );
}
