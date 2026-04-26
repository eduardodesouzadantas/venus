import type { VenusResultState } from "@/lib/venus/brand";
import type { VenusStylistAudit } from "@/lib/venus/audit/engine";
import type { WhatsAppStylistCommercePlan } from "@/lib/whatsapp/stylist-engine";
import type { WhatsAppLookItemContext } from "@/types/whatsapp";
import { normalizeConsultivePieceRole, buildCurationByPieceRole, type PremiumCurationPieceRole } from "@/lib/result/curation-roles";

export const VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION = "venus_whatsapp_consultive_v1" as const;

// Re-export from the canonical source so external callers keep the same import path.
export type VenusWhatsAppConsultiveRole = PremiumCurationPieceRole;

export type VenusWhatsAppConsultivePayload = {
  version: typeof VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION;
  tenant: {
    orgId: string;
    slug?: string;
    isInternalShowroom?: boolean;
  };
  customerIntent: {
    occasion?: string;
    budgetRange?: string;
    styleDirection?: string;
    restrictions?: string[];
  };
  visualSignature: {
    summary: string;
    palette?: string[];
    contrast?: string;
    styleWords?: string[];
  };
  curation: {
    status: "ready" | "partial" | "insufficient_catalog";
    looks: Array<{
      title: string;
      rationale: string;
      pieces: Array<{
        productId: string;
        name: string;
        role: VenusWhatsAppConsultiveRole;
        reason: string;
      }>;
    }>;
    missingSlots?: string[];
  };
  tryOn?: {
    state: VenusResultState | "not_requested" | "not_available";
    shouldShow: boolean;
  };
  handoff: {
    suggestedOpeningMessage: string;
    salesNotes: string[];
    nextBestActions: string[];
  };
  diagnostics: {
    generatedAt: string;
    source: string;
    warnings: string[];
  };
};

// Union allows both the concrete WhatsAppLookItemContext and legacy plain objects.
// buildPiecesFromItems casts to Record<string, unknown> internally for dynamic field access.
type LegacyLookItem = WhatsAppLookItemContext | Record<string, unknown>;

type LegacyLook = {
  name?: string | null;
  explanation?: string | null;
  whenToWear?: string | null;
  items?: LegacyLookItem[];
};

export type BuildVenusWhatsAppConsultivePayloadInput = {
  orgId: string;
  orgSlug?: string | null;
  isInternalShowroom?: boolean;
  payload?: Record<string, unknown> | null;
  audit?: VenusStylistAudit | null;
  commerce?: WhatsAppStylistCommercePlan | null;
  resultState?: VenusResultState | "not_requested" | "not_available" | null;
  lookSummary?: LegacyLook[] | null;
  source?: string;
  generatedAt?: string;
};

export type VenusWhatsAppConsultiveLogPayload = {
  version: unknown;
  tenant: unknown;
  curation: {
    status: unknown;
    lookCount: number;
    pieceCount: number;
    missingSlots: unknown;
  };
  tryOn: unknown;
  diagnostics: unknown;
};

const SENSITIVE_KEY_PATTERN = /(phone|telefone|email|photo|foto|imageurl|image_url|signedurl|signed_url|base64|token|secret|raw|payload|authorization|cookie)/i;
const CUSTOMER_NAME_PATTERN = /(customername|contactname|fullname|full_name|nomecompleto)/i;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeList(value: unknown, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeText(entry)).filter(Boolean).slice(0, limit);
}

function unique(values: Array<string | null | undefined>, limit = 6) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).slice(0, limit);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}


function normalizeProductId(value: unknown) {
  return normalizeText(value);
}

function buildPiecesFromItems(items: LegacyLookItem[] | undefined | null) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const rec = item as Record<string, unknown>;
      const productId = normalizeProductId(rec.productId || rec.product_id || rec.id);
      if (!productId) return null;

      return {
        productId,
        name: normalizeText(rec.name || rec.title) || "Peca do catalogo",
        role: normalizeConsultivePieceRole(rec.role || rec.stylistRole || rec.catalogRole, index),
        reason: normalizeText(rec.reason || rec.conversionCopy || rec.impactLine || rec.description) || "Entra na curadoria por coerencia com a leitura visual.",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

type PayloadLook = {
  title: string;
  rationale: string;
  pieces: Array<{ productId: string; name: string; role: PremiumCurationPieceRole; reason: string }>;
};

type BuildLooksResult = {
  looks: PayloadLook[];
  curationMissingSlots: string[];
};

function buildLooksWithCuration(input: BuildVenusWhatsAppConsultivePayloadInput): BuildLooksResult {
  const commerceLooks = input.commerce?.completeLooks || [];
  if (commerceLooks.length > 0) {
    const looks = commerceLooks
      .map((look) => ({
        title: normalizeText(look.title) || "Look consultivo",
        rationale: normalizeText(look.reason) || "Composicao montada a partir da leitura visual e do catalogo disponivel.",
        pieces: buildPiecesFromItems(look.items as unknown as LegacyLookItem[]),
      }))
      .filter((look) => look.pieces.length > 0);
    return { looks, curationMissingSlots: [] };
  }

  const rawLegacy = input.lookSummary || (Array.isArray(input.payload?.lookSummary) ? input.payload?.lookSummary as LegacyLook[] : []);
  const curation = buildCurationByPieceRole({
    looks: rawLegacy.map((look) => ({
      title: look.name,
      name: look.name,
      rationale: look.explanation || look.whenToWear,
      explanation: look.explanation,
      items: look.items,
    })),
  });

  const looks: PayloadLook[] = curation.looks.map((look) => ({
    title: look.title,
    rationale: look.rationale,
    pieces: look.pieces.map((p) => ({
      productId: p.productId,
      name: p.name,
      role: p.role,
      reason: p.reason,
    })),
  }));

  return { looks, curationMissingSlots: curation.missingSlots.map(String) };
}

function inferMissingSlots(payload: Record<string, unknown>, warnings: string[], curationMissingSlots: string[]) {
  // Explicit slots from the caller take precedence (they come from business logic / catalog engine).
  const explicit = normalizeList(payload.missingSlots || payload.missing_slots, 8);
  if (explicit.length > 0) return explicit;
  // Curation-derived slots are the next best signal.
  if (curationMissingSlots.length > 0) return curationMissingSlots;
  if (warnings.some((warning) => warning.includes("catalog"))) return ["catalog"];
  return [];
}

function inferCurationStatus(
  looks: PayloadLook[],
  missingSlots: string[],
  commerce?: WhatsAppStylistCommercePlan | null,
): VenusWhatsAppConsultivePayload["curation"]["status"] {
  if (commerce && commerce.available === false) return "insufficient_catalog";
  if (looks.length === 0) return "insufficient_catalog";
  if (missingSlots.length > 0 || looks.some((look) => look.pieces.length < 2)) return "partial";
  return "ready";
}

function inferTryOnState(input: BuildVenusWhatsAppConsultivePayloadInput): VenusWhatsAppConsultivePayload["tryOn"] {
  const state = input.resultState || normalizeText(input.payload?.resultState) as VenusResultState | "";
  if (state === "hero" || state === "preview" || state === "retry_required") {
    return { state, shouldShow: state === "hero" || state === "preview" };
  }

  const lastTryOn = asRecord(input.payload?.lastTryOn);
  if (normalizeText(lastTryOn.status) === "completed") {
    return { state: "preview", shouldShow: false };
  }

  return { state: "not_requested", shouldShow: false };
}

function inferWarnings(input: BuildVenusWhatsAppConsultivePayloadInput) {
  const payload = input.payload || {};
  return unique([
    ...(normalizeList(payload.warnings, 8)),
    input.commerce?.fallbackReason ? `catalog:${input.commerce.fallbackReason}` : null,
    !input.orgId ? "missing_org_id" : null,
  ], 10);
}

export function buildVenusWhatsAppConsultivePayload(
  input: BuildVenusWhatsAppConsultivePayloadInput
): VenusWhatsAppConsultivePayload {
  const payload = input.payload || {};
  const audit = input.audit || asRecord(payload.audit) as VenusStylistAudit | null;
  const warnings = inferWarnings(input);
  const { looks, curationMissingSlots } = buildLooksWithCuration(input);
  const missingSlots = inferMissingSlots(payload, warnings, curationMissingSlots);
  const status = inferCurationStatus(looks, missingSlots, input.commerce);
  const styleWords = unique([
    normalizeText(payload.styleIdentity),
    normalizeText(payload.dominantStyle),
    audit?.direction?.title,
    audit?.diagnosis?.hiddenPotential,
  ], 4);
  const palette = unique([
    ...normalizeList(payload.palette, 4),
    normalizeText(payload.paletteFamily),
    normalizeText(payload.metal),
  ], 5);
  const summary =
    normalizeText(audit?.diagnosis?.positioning) ||
    normalizeText(audit?.opening?.title) ||
    normalizeText(payload.styleIdentity || payload.dominantStyle) ||
    "Assinatura visual consultiva em refinamento.";
  const occasion = normalizeText(payload.occasion || payload.whenToWear || payload.user_occasion);
  const styleDirection = normalizeText(payload.styleDirection || payload.styleIdentity || payload.dominantStyle);
  const suggestedOpeningMessage = normalizeText(input.commerce?.openingLine) ||
    `Oi. Sou a Venus. Sua curadoria foi preparada com base na sua assinatura visual: ${summary}`;

  return {
    version: VENUS_WHATSAPP_CONSULTIVE_PAYLOAD_VERSION,
    tenant: {
      orgId: input.orgId,
      ...(input.orgSlug ? { slug: input.orgSlug } : {}),
      ...(input.isInternalShowroom ? { isInternalShowroom: true } : {}),
    },
    customerIntent: {
      ...(occasion ? { occasion } : {}),
      ...(normalizeText(payload.budgetRange || payload.priceRange) ? { budgetRange: normalizeText(payload.budgetRange || payload.priceRange) } : {}),
      ...(styleDirection ? { styleDirection } : {}),
      ...(normalizeList(payload.restrictions, 8).length > 0 ? { restrictions: normalizeList(payload.restrictions, 8) } : {}),
    },
    visualSignature: {
      summary,
      ...(palette.length > 0 ? { palette } : {}),
      ...(normalizeText(payload.contrast) ? { contrast: normalizeText(payload.contrast) } : {}),
      ...(styleWords.length > 0 ? { styleWords } : {}),
    },
    curation: {
      status,
      looks,
      ...(missingSlots.length > 0 ? { missingSlots } : {}),
    },
    tryOn: inferTryOnState(input),
    handoff: {
      suggestedOpeningMessage,
      salesNotes: unique([
        input.commerce?.summaryLine,
        input.commerce?.upsellLine,
        input.commerce?.crossSellLine,
        input.commerce?.alternativeLine,
      ], 6),
      nextBestActions: status === "insufficient_catalog"
        ? ["chamar_humano", "confirmar_estoque", "sugerir_alternativa"]
        : ["confirmar_tamanho", "ajustar_budget", "enviar_link_ou_reserva"],
    },
    diagnostics: {
      generatedAt: input.generatedAt || new Date().toISOString(),
      source: input.source || "whatsapp_handoff",
      warnings,
    },
  };
}

function maskPhoneLike(value: unknown) {
  const text = normalizeText(value);
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return "[REDACTED]";
  return `***${digits.slice(-4)}`;
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (CUSTOMER_NAME_PATTERN.test(key)) return "[REDACTED]";
  if (/phone|telefone/i.test(key)) return maskPhoneLike(value);
  if (SENSITIVE_KEY_PATTERN.test(key)) return "[REDACTED]";

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      next[entryKey] = sanitizeValue(entryValue, entryKey);
    }
    return next;
  }

  return value;
}

export function sanitizeVenusWhatsAppConsultivePayloadForLogs(payload: unknown): VenusWhatsAppConsultiveLogPayload {
  const sanitized = sanitizeValue(payload) as Record<string, unknown>;
  const curation = asRecord(sanitized.curation);
  const looks = Array.isArray(curation.looks) ? curation.looks : [];

  return {
    version: sanitized.version,
    tenant: sanitized.tenant,
    curation: {
      status: curation.status,
      lookCount: looks.length,
      pieceCount: looks.reduce((count, look) => {
        const pieces = asRecord(look).pieces;
        return count + (Array.isArray(pieces) ? pieces.length : 0);
      }, 0),
      missingSlots: curation.missingSlots,
    },
    tryOn: sanitized.tryOn,
    diagnostics: sanitized.diagnostics,
  };
}
