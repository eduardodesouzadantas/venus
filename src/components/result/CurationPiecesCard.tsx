"use client";

import React from "react";
import { ShoppingBag } from "lucide-react";

export interface CurationPiece {
  id: string;
  productId?: string;
  name: string;
  photoUrl?: string;
  role?: "hero" | "base" | "equilibrio" | "ponto_focal" | "acabamento" | "alternativa";
  reason?: string;
  price?: number;
  currency?: string;
  url?: string;
}

interface CurationPieceCardProps {
  piece: CurationPiece;
  onSelect?: () => void;
  onBuy?: () => void;
}

const ROLE_LABELS: Record<string, { label: string; reason: string }> = {
  hero: { label: "Protagonista", reason: "Peça que define o look" },
  base: { label: "Base", reason: "Estrutura a composição" },
  equilibrio: { label: "Equilíbrio", reason: "Suaviza a leitura" },
  ponto_focal: { label: "Destaque", reason: "Cria interesse visual" },
  acabamento: { label: "Acabamento", reason: "Aumenta o valor" },
  alternativa: { label: "Alternativa", reason: "Substitui por preço/tamanho" },
};

function normalizeRole(role: CurationPiece["role"] | string | undefined): keyof typeof ROLE_LABELS {
  return role && ROLE_LABELS[role] ? role : "base";
}

function shortText(value: string | undefined, maxLength = 110): string {
  if (!value) return "";
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function formatPrice(price: number | undefined, currency: string = "BRL"): string {
  if (!price) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

export function CurationPieceCard({ piece, onSelect, onBuy }: CurationPieceCardProps) {
  const role = normalizeRole(piece.role);
  const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.base;
  const reason = shortText(piece.reason);
  const handleBuy = () => {
    if (onBuy) {
      onBuy();
      return;
    }
    if (piece.url) {
      window.open(piece.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] transition-all hover:border-[#C9A84C]/30">
      <div className="relative aspect-[3/4] bg-black/40">
        {piece.photoUrl ? (
          <img
            src={piece.photoUrl}
            alt={piece.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-16 w-16 rounded-full border border-white/10 bg-white/[0.02]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        <div className="absolute top-3 left-3">
          <span className="rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-[#C9A84C]">
            {roleInfo.label}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="font-serif text-lg text-white">{piece.name}</p>
          {reason && (
            <p className="mt-1 text-xs text-white/60">{reason}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 p-3">
        <div className="flex items-center gap-2">
          {piece.price ? (
            <span className="text-sm font-medium text-white">
              {formatPrice(piece.price, piece.currency)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-white/50">
              <ShoppingBag className="h-3 w-3" />
              Peça da loja
            </span>
          )}
        </div>

        {piece.url || onBuy ? (
          <button
            onClick={handleBuy}
            className="rounded-xl bg-[#C9A84C] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#C9A84C]/90"
          >
            Quero esse look
          </button>
        ) : (
          <button
            onClick={onSelect}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/[0.05]"
          >
            Ver detalhes
          </button>
        )}
      </div>
    </div>
  );
}

interface CurationPiecesGridProps {
  pieces: CurationPiece[];
  onSelectPiece?: (piece: CurationPiece) => void;
  onBuyPiece?: (piece: CurationPiece) => void;
}

export function CurationPiecesGrid({ pieces, onSelectPiece, onBuyPiece }: CurationPiecesGridProps) {
  const realPieces = pieces.filter((piece) => piece.id && piece.name);
  if (realPieces.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {realPieces.map((piece) => (
        <CurationPieceCard
          key={piece.id}
          piece={piece}
          onSelect={() => onSelectPiece?.(piece)}
          onBuy={() => onBuyPiece?.(piece)}
        />
      ))}
    </div>
  );
}

interface LookCompositionCardProps {
  lookName: string;
  pieces: CurationPiece[];
  explanation?: string;
  onSelectLook?: () => void;
  onBuyLook?: () => void;
}

const ROLE_ORDER = ["hero", "base", "equilibrio", "ponto_focal", "acabamento", "alternativa"];

export function LookCompositionCard({ lookName, pieces, explanation, onSelectLook, onBuyLook }: LookCompositionCardProps) {
  const realPieces = pieces.filter((piece) => piece.id && piece.name);
  if (realPieces.length === 0) return null;

  const sortedPieces = [...realPieces].sort((a, b) => {
    const orderA = ROLE_ORDER.indexOf(normalizeRole(a.role));
    const orderB = ROLE_ORDER.indexOf(normalizeRole(b.role));
    return orderA - orderB;
  });

  const totalPrice = realPieces.reduce((sum, p) => sum + (p.price || 0), 0);
  const summary = shortText(explanation, 150);

  return (
    <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.02] p-4">
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#C9A84C]">Peças escolhidas</p>
        <h3 className="font-serif text-xl text-white">{lookName}</h3>
        {summary && (
          <p className="text-sm text-white/60">{summary}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sortedPieces.map((piece, index) => (
          <div key={piece.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-2">
            <div className="relative h-12 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-black/40">
              {piece.photoUrl ? (
                <img src={piece.photoUrl} alt={piece.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-4 w-4 rounded-full border border-white/10" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-medium text-white">{piece.name}</p>
              <p className="truncate text-[8px] text-white/50">
                {ROLE_LABELS[normalizeRole(piece.role)]?.label || "Base"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        {totalPrice > 0 && (
          <div className="text-sm">
            <span className="text-white/50">Total: </span>
            <span className="font-medium text-white">{formatPrice(totalPrice)}</span>
          </div>
        )}

        <div className="flex gap-2">
          {onSelectLook && (
            <button
              onClick={onSelectLook}
              className="rounded-xl border border-white/10 px-3 py-2 text-[9px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/[0.05]"
            >
              Ver detalhes
            </button>
          )}
          {onBuyLook && (
            <button
              onClick={onBuyLook}
              className="rounded-xl bg-[#C9A84C] px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#C9A84C]/90"
            >
              Quero esse look
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
