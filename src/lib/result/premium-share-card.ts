import { getPieceRoleLabel } from "@/lib/result/premium-result-copy";
import type { PremiumCurationPieceRole } from "@/lib/result/curation-roles";

export type ShareCardCurationPiece = {
  productId?: unknown;
  name?: unknown;
  role?: PremiumCurationPieceRole | string | null;
};

export type BuildPremiumShareCardModelInput = {
  signatureName?: string | null;
  signatureSummary?: string | null;
  styleWords?: string[] | null;
  palette?: string[] | null;
  occasion?: string | null;
  storeName?: string | null;
  curationPieces?: ShareCardCurationPiece[] | null;
  hasValidAnalysis?: boolean | null;
  hasCuration?: boolean | null;
};

export type PremiumShareCardFlags = {
  usesTryOn: false;
  hasCuration: boolean;
  isShareable: boolean;
};

export type PremiumShareCardModel = {
  title: string;
  subtitle: string;
  visualSignatureSummary: string;
  styleWords: string[];
  paletteLabels: string[];
  curationHighlights: string[];
  pieceRoleHighlights: string[];
  shareCaption: string;
  ctaLabel: string;
  warnings: string[];
  flags: PremiumShareCardFlags;
};

const SENSITIVE_PATTERN =
  /(@|base64|data:image|signedurl|signed_url|imageurl|image_url|token|secret|raw|https?:\/\/|\+?\d[\d\s().-]{7,}|nome\s+completo|cliente\.real)/i;

const BODY_JUDGMENT_PATTERN =
  /disfar[cç]a|imperfei[cç][aã]o|mais magr|engorda|esconde\s+(corp|barrig|quadril)|afina\s+o\s+corp|corrig(e|iu|indo)\s+(corp|silhuet)|n[aã]o\s+favorece|perfeito\s+garantido/i;

const GUARANTEE_PATTERN =
  /transformac[aã]o\s+garantida|vai\s+mudar\s+tudo|look\s+perfeito\s+garantido|resultado\s+garantido/i;

const VALID_ROLE_SET = new Set<string>([
  "hero",
  "base",
  "equilibrio",
  "ponto_focal",
  "acabamento",
  "alternativa",
]);

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_PATTERN.test(trimmed) || BODY_JUDGMENT_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function safeList(values: unknown, limit = 6): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => safeText(v, ""))
    .filter(Boolean)
    .slice(0, limit);
}

function isCanonicalRole(role: unknown): role is PremiumCurationPieceRole {
  return typeof role === "string" && VALID_ROLE_SET.has(role);
}

function buildCurationHighlights(pieces: ShareCardCurationPiece[]): string[] {
  return pieces
    .slice(0, 5)
    .map((piece) => {
      const name = safeText(piece.name, "");
      if (!name) return "";
      const role = isCanonicalRole(piece.role) ? piece.role : null;
      const label = role ? getPieceRoleLabel(role) : "Peca do look";
      return `${label}: ${name}`;
    })
    .filter(Boolean);
}

function buildPieceRoleHighlights(pieces: ShareCardCurationPiece[]): string[] {
  const seen = new Set<string>();
  return pieces
    .slice(0, 5)
    .flatMap((piece) => {
      if (!isCanonicalRole(piece.role) || seen.has(piece.role)) return [];
      seen.add(piece.role);
      return [getPieceRoleLabel(piece.role)];
    });
}

function buildShareCaption(signatureName: string, storeName: string, hasCuration: boolean): string {
  const store = storeName !== "a loja" ? ` na ${storeName}` : "";
  if (hasCuration) {
    return `Descobri minha assinatura visual${store}. Curadoria criada pela Venus com pecas reais da loja.`;
  }
  return `Descobri minha assinatura visual com a Venus${store}.`;
}

export function buildPremiumShareCardModel(
  input: BuildPremiumShareCardModelInput = {},
): PremiumShareCardModel {
  const signatureName = safeText(input.signatureName, "Assinatura visual");
  const signatureSummary = safeText(
    input.signatureSummary,
    "Uma leitura de estilo criada para orientar escolhas reais.",
  );
  const storeName = safeText(input.storeName, "a loja");
  const styleWords = safeList(input.styleWords, 4);
  const paletteLabels = safeList(input.palette, 5);
  const pieces = Array.isArray(input.curationPieces) ? input.curationPieces : [];
  const hasValidAnalysis = input.hasValidAnalysis !== false;
  const hasCuration = Boolean(input.hasCuration ?? pieces.length > 0);
  const isShareable = hasValidAnalysis;

  const curationHighlights = buildCurationHighlights(pieces);
  const pieceRoleHighlights = buildPieceRoleHighlights(pieces);

  const shareCaption = buildShareCaption(signatureName, storeName, hasCuration);

  const warnings: string[] = [
    ...(!hasValidAnalysis ? ["analysis:not_ready"] : []),
    ...(!hasCuration ? ["curation:unavailable"] : []),
    ...(GUARANTEE_PATTERN.test(signatureSummary) ? ["copy:guarantee_detected"] : []),
  ];

  return {
    title: signatureName,
    subtitle: hasCuration
      ? "Curadoria com pecas reais da loja"
      : "Leitura de estilo pela Venus",
    visualSignatureSummary: signatureSummary,
    styleWords,
    paletteLabels,
    curationHighlights,
    pieceRoleHighlights,
    shareCaption,
    ctaLabel: hasCuration
      ? "Ver minha curadoria"
      : "Descobrir minha assinatura visual",
    warnings,
    flags: {
      usesTryOn: false,
      hasCuration,
      isShareable,
    },
  };
}
