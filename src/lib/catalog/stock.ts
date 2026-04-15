export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export const STOCK_STATUS_VALUES: StockStatus[] = ["in_stock", "low_stock", "out_of_stock"];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "Em estoque",
  low_stock: "Estoque baixo",
  out_of_stock: "Sem estoque",
};

export interface ProductStockSnapshot {
  totalQty: number;
  reservedQty: number;
  availableQty: number;
  stockStatus: StockStatus;
  source: "stock_qty" | "stock" | "variants" | "fallback";
}

export interface InventoryAlert {
  id: string;
  type: "rupture" | "dead_stock" | "demand_reprimida";
  severity: "critical" | "alert" | "info";
  title: string;
  description: string;
  productId?: string;
  productName?: string;
  availableQty: number;
  tryons7d: number;
  tryons30d: number;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.floor(value));
  }

  const raw = normalizeString(value);
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

export function normalizeStockStatus(value: unknown): StockStatus | null {
  const raw = normalizeString(value).toLowerCase();
  if (raw === "in_stock" || raw === "instock" || raw === "em_estoque") return "in_stock";
  if (raw === "low_stock" || raw === "lowstock" || raw === "estoque_baixo") return "low_stock";
  if (raw === "out_of_stock" || raw === "outofstock" || raw === "sem_estoque") return "out_of_stock";
  return null;
}

export function deriveStockStatus(totalQty: number, reservedQty = 0, lowStockThreshold = 5): StockStatus {
  const availableQty = Math.max(totalQty - reservedQty, 0);

  if (availableQty <= 0) {
    return "out_of_stock";
  }

  if (availableQty <= lowStockThreshold) {
    return "low_stock";
  }

  return "in_stock";
}

export function formatStockStatusLabel(status: StockStatus | string | null | undefined) {
  const normalized = normalizeStockStatus(status);
  if (!normalized) {
    return "Status não informado";
  }

  return STOCK_STATUS_LABELS[normalized];
}

export function sumVariantQuantity(rows: Array<{ quantity?: unknown; active?: unknown }> | null | undefined) {
  if (!Array.isArray(rows)) return 0;

  return rows.reduce((total, row) => {
    if (!row || row.active === false) return total;
    const quantity = parseNonNegativeInteger(row.quantity);
    return total + (quantity ?? 0);
  }, 0);
}

export function resolveProductStockSnapshot(
  product: Record<string, unknown>,
  variantQuantityTotal: number | null | undefined = null
): ProductStockSnapshot {
  const totalFromStockQty = parseNonNegativeInteger(product.stock_qty);
  const totalFromStock = parseNonNegativeInteger(product.stock);
  const totalFromVariants = parseNonNegativeInteger(variantQuantityTotal);
  const reservedQty = parseNonNegativeInteger(product.reserved_qty) ?? 0;

  const source = totalFromStockQty !== null ? "stock_qty" : totalFromStock !== null ? "stock" : totalFromVariants !== null ? "variants" : "fallback";
  const totalQty = totalFromStockQty ?? totalFromStock ?? totalFromVariants ?? 0;
  const availableQty = Math.max(totalQty - reservedQty, 0);
  const stockStatus = normalizeStockStatus(product.stock_status) ?? deriveStockStatus(totalQty, reservedQty);

  return {
    totalQty,
    reservedQty,
    availableQty,
    stockStatus,
    source,
  };
}

export function buildInventoryAlerts(input: {
  productId: string;
  productName: string;
  stockSnapshot: ProductStockSnapshot;
  tryons7d: number;
  tryons30d: number;
}): InventoryAlert[] {
  const availableQty = Math.max(input.stockSnapshot.availableQty, 0);
  const alerts: InventoryAlert[] = [];

  if (availableQty <= 0) {
    alerts.push({
      id: `rupture:${input.productId}`,
      type: "rupture",
      severity: "critical",
      title: "Ruptura",
      description: `${input.productName} está sem estoque disponível.`,
      productId: input.productId,
      productName: input.productName,
      availableQty,
      tryons7d: input.tryons7d,
      tryons30d: input.tryons30d,
    });
  }

  if (availableQty > 0 && input.tryons30d === 0) {
    alerts.push({
      id: `dead_stock:${input.productId}`,
      type: "dead_stock",
      severity: availableQty > 5 ? "alert" : "info",
      title: "Dead stock",
      description: `${input.productName} não recebeu try-on nos últimos 30 dias e segue com ${availableQty} unidades disponíveis.`,
      productId: input.productId,
      productName: input.productName,
      availableQty,
      tryons7d: input.tryons7d,
      tryons30d: input.tryons30d,
    });
  }

  if (availableQty >= 0 && input.tryons7d > availableQty) {
    const gap = input.tryons7d - availableQty;
    alerts.push({
      id: `demand:${input.productId}`,
      type: "demand_reprimida",
      severity: gap > 3 ? "critical" : "alert",
      title: "Demanda reprimida",
      description: `${input.productName} teve ${input.tryons7d} try-ons na semana com apenas ${availableQty} unidades disponíveis.`,
      productId: input.productId,
      productName: input.productName,
      availableQty,
      tryons7d: input.tryons7d,
      tryons30d: input.tryons30d,
    });
  }

  return alerts;
}
