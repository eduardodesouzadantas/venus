export type PremiumCurationStatus = "ready" | "partial" | "insufficient_catalog";

export type PremiumCurationPieceRole =
  | "hero"
  | "base"
  | "equilibrio"
  | "ponto_focal"
  | "acabamento"
  | "alternativa";

export type PremiumCurationSourcePiece = {
  id?: unknown;
  productId?: unknown;
  product_id?: unknown;
  sku?: unknown;
  name?: unknown;
  title?: unknown;
  category?: unknown;
  type?: unknown;
  role?: unknown;
  stylistRole?: unknown;
  catalogRole?: unknown;
  reason?: unknown;
  rationale?: unknown;
  conversionCopy?: unknown;
  impactLine?: unknown;
  description?: unknown;
  styleTags?: unknown;
  categoryTags?: unknown;
  useCases?: unknown;
};

export type PremiumCurationSourceLook = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  rationale?: unknown;
  reason?: unknown;
  explanation?: unknown;
  items?: PremiumCurationSourcePiece[] | null;
};

export type BuildCurationByPieceRoleInput = {
  looks?: PremiumCurationSourceLook[] | null;
  products?: PremiumCurationSourcePiece[] | null;
  source?: string | null;
};

export type PremiumCurationPiece = {
  productId: string;
  name: string;
  role: PremiumCurationPieceRole;
  slot: string;
  category?: string;
  reason: string;
  sourceIndex: number;
};

export type PremiumCurationLook = {
  title: string;
  rationale: string;
  pieces: PremiumCurationPiece[];
};

export type PremiumCurationModel = {
  status: PremiumCurationStatus;
  looks: PremiumCurationLook[];
  missingSlots: PremiumCurationPieceRole[];
  warnings: string[];
  counts: {
    looks: number;
    pieces: number;
    roles: Partial<Record<PremiumCurationPieceRole, number>>;
  };
};

const ROLE_ORDER: PremiumCurationPieceRole[] = [
  "hero",
  "base",
  "equilibrio",
  "ponto_focal",
  "acabamento",
  "alternativa",
];

const REQUIRED_READY_ROLES: PremiumCurationPieceRole[] = ["hero", "base", "acabamento"];
const SENSITIVE_TEXT_PATTERN =
  /(@|base64|data:image|signedurl|signed_url|imageurl|image_url|token|secret|raw|payload|https?:\/\/|\+?\d[\d\s().-]{7,}|nome\s+completo|cliente\.real)/i;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function publicText(value: unknown, fallback: string): string {
  const text = normalizeText(value);
  if (!text || SENSITIVE_TEXT_PATTERN.test(text)) return fallback;
  return text;
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeText(entry)).filter(Boolean);
}

function includesAny(source: string, needles: string[]) {
  return needles.some((needle) => source.includes(needle));
}

function normalizeProductId(piece: PremiumCurationSourcePiece, fallbackIndex: number): string {
  const explicit = normalizeText(piece.productId || piece.product_id || piece.id || piece.sku);
  if (explicit && !SENSITIVE_TEXT_PATTERN.test(explicit)) return explicit;
  return `catalog-piece-${fallbackIndex + 1}`;
}

function inferSlot(piece: PremiumCurationSourcePiece): string {
  const source = normalizeSearchText([
    piece.name,
    piece.title,
    piece.category,
    piece.type,
    piece.role,
    piece.stylistRole,
    piece.catalogRole,
    piece.description,
    ...normalizeList(piece.styleTags),
    ...normalizeList(piece.categoryTags),
    ...normalizeList(piece.useCases),
  ].join(" "));

  if (includesAny(source, ["one_piece", "vestido", "dress", "macacao"])) return "one_piece";
  if (includesAny(source, ["layer", "blazer", "casaco", "jaqueta", "terceira peca"])) return "layer";
  if (includesAny(source, ["bottom", "calca", "trouser", "jeans", "saia", "short", "bermuda"])) return "bottom";
  if (includesAny(source, ["top", "camisa", "blusa", "camiseta", "regata", "tricot"])) return "top";
  if (includesAny(source, ["shoes", "sapato", "tenis", "sapatilha", "sandalia", "bota", "loafer"])) return "shoes";
  if (includesAny(source, ["accessory", "acessorio", "acessorio", "bolsa", "cinto", "colar", "brinco", "relogio", "oculos"])) return "accessory";
  return "unknown";
}

export function normalizeConsultivePieceRole(value: unknown, index = 0): PremiumCurationPieceRole {
  const role = normalizeSearchText(value);

  if (role === "hero" || role === "anchor" || role === "statement" || role === "protagonista") return "hero";
  if (role === "base") return "base";
  if (role === "support" || role === "equilibrio" || role === "equilibrium" || role === "apoio") return "equilibrio";
  if (role === "ponto_focal" || role === "ponto focal" || role === "focal" || role === "focus" || role === "destaque") return "ponto_focal";
  if (role === "accessory" || role === "acessorio" || role === "accessorio" || role === "finish" || role === "finishing" || role === "acabamento") return "acabamento";
  if (role === "alternative" || role === "alternativa" || role === "substituicao") return "alternativa";

  if (index === 0) return "hero";
  if (index === 1) return "base";
  if (index === 2) return "acabamento";
  return "alternativa";
}

function inferRoleFromSlot(
  piece: PremiumCurationSourcePiece,
  index: number,
  assignedRoles: Set<PremiumCurationPieceRole>,
): PremiumCurationPieceRole {
  const explicit = normalizeConsultivePieceRole(piece.role || piece.stylistRole || piece.catalogRole, -1);
  if (normalizeText(piece.role || piece.stylistRole || piece.catalogRole)) return explicit;

  const slot = inferSlot(piece);
  const source = normalizeSearchText([piece.name, piece.title, piece.category, piece.type, piece.description].join(" "));
  const hasFocalCue = includesAny(source, ["statement", "destaque", "focal", "metal", "vermelho", "vinho", "cor"]);

  if ((slot === "one_piece" || slot === "layer") && !assignedRoles.has("hero")) return "hero";
  if ((slot === "top" || slot === "bottom") && !assignedRoles.has("base")) return "base";
  if ((slot === "shoes" || slot === "accessory") && hasFocalCue && !assignedRoles.has("ponto_focal")) return "ponto_focal";
  if ((slot === "shoes" || slot === "accessory") && !assignedRoles.has("acabamento")) return "acabamento";
  if ((slot === "top" || slot === "bottom" || slot === "layer") && !assignedRoles.has("equilibrio")) return "equilibrio";

  return normalizeConsultivePieceRole(null, index);
}

function rationaleForRole(role: PremiumCurationPieceRole): string {
  switch (role) {
    case "hero":
      return "Define a proposta principal da curadoria.";
    case "base":
      return "Sustenta a composicao e deixa a leitura mais clara.";
    case "equilibrio":
      return "Harmoniza a composicao sem aumentar ruido visual.";
    case "ponto_focal":
      return "Adiciona destaque controlado ao look.";
    case "acabamento":
      return "Finaliza a leitura com acabamento consultivo.";
    case "alternativa":
      return "Funciona como substituicao segura quando a peca ideal nao esta disponivel.";
  }
}

function normalizePiece(
  piece: PremiumCurationSourcePiece,
  sourceIndex: number,
  assignedRoles: Set<PremiumCurationPieceRole>,
): PremiumCurationPiece | null {
  const productId = normalizeProductId(piece, sourceIndex);
  const role = inferRoleFromSlot(piece, sourceIndex, assignedRoles);
  const slot = inferSlot(piece);
  const name = publicText(piece.name || piece.title, "Peca do catalogo");
  const reason = publicText(
    piece.reason || piece.rationale || piece.conversionCopy || piece.impactLine || piece.description,
    rationaleForRole(role),
  );

  assignedRoles.add(role);

  return {
    productId,
    name,
    role,
    slot,
    ...(publicText(piece.category || piece.type, "") ? { category: publicText(piece.category || piece.type, "") } : {}),
    reason,
    sourceIndex,
  };
}

function buildLook(
  look: PremiumCurationSourceLook,
  lookIndex: number,
): PremiumCurationLook | null {
  const items = Array.isArray(look.items) ? look.items : [];
  const assignedRoles = new Set<PremiumCurationPieceRole>();
  const pieces = items
    .map((piece, pieceIndex) => normalizePiece(piece, pieceIndex, assignedRoles))
    .filter((piece): piece is PremiumCurationPiece => Boolean(piece));

  if (pieces.length === 0) return null;

  return {
    title: publicText(look.title || look.name, `Curadoria ${lookIndex + 1}`),
    rationale: publicText(
      look.rationale || look.reason || look.explanation,
      "Composicao consultiva montada a partir das pecas disponiveis.",
    ),
    pieces,
  };
}

function normalizeLooks(input: BuildCurationByPieceRoleInput): PremiumCurationSourceLook[] {
  if (Array.isArray(input.looks) && input.looks.length > 0) return input.looks;
  if (Array.isArray(input.products) && input.products.length > 0) {
    return [{ title: "Curadoria principal", items: input.products }];
  }
  return [];
}

function countRoles(looks: PremiumCurationLook[]): Partial<Record<PremiumCurationPieceRole, number>> {
  const counts: Partial<Record<PremiumCurationPieceRole, number>> = {};
  for (const piece of looks.flatMap((look) => look.pieces)) {
    counts[piece.role] = (counts[piece.role] || 0) + 1;
  }
  return counts;
}

function inferMissingSlots(
  roles: Partial<Record<PremiumCurationPieceRole, number>>,
  pieceCount: number,
): PremiumCurationPieceRole[] {
  if (pieceCount === 0) return ["hero", "base", "acabamento"];
  return REQUIRED_READY_ROLES.filter((role) => !roles[role]);
}

function inferStatus(pieceCount: number, missingSlots: PremiumCurationPieceRole[]): PremiumCurationStatus {
  if (pieceCount < 2) return "insufficient_catalog";
  if (missingSlots.length > 0 || pieceCount < 3) return "partial";
  return "ready";
}

export function buildCurationByPieceRole(input: BuildCurationByPieceRoleInput = {}): PremiumCurationModel {
  const looks = normalizeLooks(input)
    .map(buildLook)
    .filter((look): look is PremiumCurationLook => Boolean(look));
  const pieces = looks.flatMap((look) => look.pieces);
  const roleCounts = countRoles(looks);
  const missingSlots = inferMissingSlots(roleCounts, pieces.length);
  const status = inferStatus(pieces.length, missingSlots);
  const warnings = [
    ...(status === "insufficient_catalog" ? ["catalog:insufficient"] : []),
    ...(status === "partial" ? ["catalog:partial_roles"] : []),
  ];

  return {
    status,
    looks,
    missingSlots,
    warnings,
    counts: {
      looks: looks.length,
      pieces: pieces.length,
      roles: ROLE_ORDER.reduce<Partial<Record<PremiumCurationPieceRole, number>>>((current, role) => {
        if (roleCounts[role]) current[role] = roleCounts[role];
        return current;
      }, {}),
    },
  };
}
