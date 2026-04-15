import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  Plus,
  Settings,
  Sparkles,
  Tag,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isTenantActive } from "@/lib/tenant/core";
import { updateProductStock } from "@/app/b2b/product/new/actions";
import { buildInventoryAlerts, formatStockStatusLabel, resolveProductStockSnapshot, type InventoryAlert, type ProductStockSnapshot } from "@/lib/catalog/stock";

export const dynamic = "force-dynamic";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  primary_color: string | null;
  style: string | null;
  image_url: string | null;
  stock_qty: number | null;
  reserved_qty: number | null;
  stock_status: string | null;
  stock: number | null;
  created_at: string | null;
};

type TryOnRow = {
  product_id: string | null;
  created_at: string | null;
  status: string | null;
};

type ProductView = ProductRow & {
  stockSnapshot: ProductStockSnapshot;
  alerts: InventoryAlert[];
  tryons7d: number;
  tryons30d: number;
};

function formatCatalogError(error?: string) {
  if (!error) return null;
  if (error === "tenant") return "Sessao invalida ou ausente.";
  if (error === "product_not_found") return "Produto nao encontrado para atualizar o estoque.";

  if (error.startsWith("validation:")) {
    const reason = error.split(":")[1] || "";
    if (reason === "product_required") return "Selecione um produto valido.";
    if (reason === "stock_qty_invalid") return "A quantidade total precisa ser um numero valido.";
    if (reason === "reserved_qty_invalid") return "A quantidade reservada precisa ser um numero valido.";
    if (reason === "stock_status_invalid") return "Selecione um status de estoque valido.";
    return "Corrija os dados de estoque antes de salvar.";
  }

  return error;
}

function stockTone(status: ProductStockSnapshot["stockStatus"]) {
  if (status === "in_stock") return "green";
  if (status === "low_stock") return "yellow";
  return "red";
}

function formatAlertBadge(alert: InventoryAlert) {
  if (alert.type === "rupture") return "Ruptura";
  if (alert.type === "dead_stock") return "Dead stock";
  return "Demanda reprimida";
}

async function loadCatalogData(orgId: string): Promise<ProductView[]> {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [productsResult, tryonsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, primary_color, style, image_url, stock_qty, reserved_qty, stock_status, stock, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("tryon_events")
      .select("product_id, created_at, status")
      .eq("org_id", orgId)
      .in("status", ["completed"])
      .gte("created_at", thirtyDaysAgo)
      .limit(2000),
  ]);

  if (productsResult.error) {
    throw productsResult.error;
  }

  if (tryonsResult.error) {
    throw tryonsResult.error;
  }

  const products = (productsResult.data || []) as ProductRow[];
  const tryons = (tryonsResult.data || []) as TryOnRow[];
  const tryonsByProduct = new Map<string, TryOnRow[]>();

  for (const row of tryons) {
    if (!row.product_id) continue;
    const current = tryonsByProduct.get(row.product_id) || [];
    current.push(row);
    tryonsByProduct.set(row.product_id, current);
  }

  return products.map((product) => {
    const productTryons = tryonsByProduct.get(product.id) || [];
    const tryons7d = productTryons.filter((row) => (row.created_at ? new Date(row.created_at).getTime() : 0) >= new Date(sevenDaysAgo).getTime()).length;
    const tryons30d = productTryons.length;
    const stockSnapshot = resolveProductStockSnapshot(product);
    const alerts = buildInventoryAlerts({
      productId: product.id,
      productName: product.name,
      stockSnapshot,
      tryons7d,
      tryons30d,
    });

    return {
      ...product,
      stockSnapshot,
      alerts,
      tryons7d,
      tryons30d,
    };
  });
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"}`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}

function ProductCard({ orgBase, product }: { orgBase: string; product: ProductView }) {
  const stockStatusTone = stockTone(product.stockSnapshot.stockStatus);
  const alertChips = product.alerts.slice(0, 3);

  return (
    <div className="rounded-[32px] border border-white/5 bg-white/[0.02] p-5 transition-all hover:bg-white/[0.04]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-5 min-w-0">
          <div className="w-20 h-20 rounded-[28px] bg-white/10 relative overflow-hidden flex-shrink-0">
            {product.image_url ? (
              <img src={product.image_url} className="w-full h-full object-cover" alt={product.name} />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <ImageIcon size={22} className="text-white/20" />
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Heading as="h3" className="text-xl uppercase tracking-tight leading-none truncate">
                {product.name}
              </Heading>
              <span className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.25em] ${stockStatusTone === "green" ? "bg-green-500/15 text-green-300" : stockStatusTone === "yellow" ? "bg-yellow-500/15 text-yellow-300" : "bg-red-500/15 text-red-300"}`}>
                {formatStockStatusLabel(product.stockSnapshot.stockStatus)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/35">
              <span>{product.category || "categoria"}</span>
              <span>•</span>
              <span>{product.style || "estilo"}</span>
              <span>•</span>
              <span>{product.primary_color || "cor"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.24em] text-white/30">
              <span className="rounded-full border border-white/10 px-3 py-1">Total {product.stockSnapshot.totalQty}</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Reservado {product.stockSnapshot.reservedQty}</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Disponível {product.stockSnapshot.availableQty}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {alertChips.length ? (
            alertChips.map((alert) => (
              <span
                key={alert.id}
                className={`rounded-full border px-3 py-1 text-[8px] font-bold uppercase tracking-[0.25em] ${
                  alert.severity === "critical"
                    ? "border-red-500/25 bg-red-500/10 text-red-300"
                    : alert.severity === "alert"
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/45"
                }`}
              >
                {formatAlertBadge(alert)}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-white/10 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.25em] text-white/35">
              Sem alertas
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr_auto]">
        <form action={updateProductStock} className="grid gap-3 md:grid-cols-4 lg:col-span-3">
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="return_to" value={`${orgBase}/catalog`} />

          <label className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Quantidade total</span>
            <input
              name="stock_qty"
              type="number"
              min={0}
              step={1}
              defaultValue={product.stockSnapshot.totalQty}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Reservado</span>
            <input
              name="reserved_qty"
              type="number"
              min={0}
              step={1}
              defaultValue={product.stockSnapshot.reservedQty}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">Status</span>
            <select
              name="stock_status"
              defaultValue={product.stockSnapshot.stockStatus}
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
            >
              <option value="in_stock">Em estoque</option>
              <option value="low_stock">Estoque baixo</option>
              <option value="out_of_stock">Sem estoque</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-black transition-colors hover:bg-white/90"
            >
              Salvar estoque
            </button>
          </div>
        </form>
      </div>

      {product.alerts.length ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {product.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                alert.severity === "critical"
                  ? "border-red-500/20 bg-red-500/10 text-red-50"
                  : alert.severity === "alert"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-50"
                    : "border-white/10 bg-black/20 text-white/70"
              }`}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/45">{alert.title}</div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed">{alert.description}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function MerchantCatalog({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: { error?: string; updated?: string };
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org || !isTenantActive(org)) {
    redirect("/merchant");
  }

  const appMeta = user.app_metadata as Record<string, string> | undefined;
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userRole = appMeta?.role ?? userMeta?.role ?? "";
  const userOrgSlug = appMeta?.org_slug ?? userMeta?.org_slug ?? "";

  if (!isAgencyRole(userRole) && userOrgSlug !== slug) {
    redirect("/merchant");
  }

  const orgBase = `/org/${slug}`;
  const products = await loadCatalogData(org.id).catch(() => []);
  const alertCount = products.reduce((total, product) => total + product.alerts.length, 0);
  const criticalCount = products.flatMap((product) => product.alerts).filter((alert) => alert.severity === "critical").length;
  const lowStockCount = products.filter((product) => product.stockSnapshot.stockStatus === "low_stock").length;
  const outOfStockCount = products.filter((product) => product.stockSnapshot.stockStatus === "out_of_stock").length;
  const catalogError = formatCatalogError(searchParams?.error);

  const navItems = [
    { href: `${orgBase}/dashboard`, icon: <LayoutGrid size={16} />, label: "Executivo" },
    { href: `${orgBase}/catalog`, icon: <Tag size={16} />, label: "Acervo", active: true },
    { href: `${orgBase}/catalog/new`, icon: <Plus size={16} />, label: "Novo produto" },
    { href: `${orgBase}/whatsapp/campaigns`, icon: <Layers size={16} />, label: "Looks & bundles" },
    { href: `${orgBase}/settings`, icon: <Settings size={16} />, label: "Configurações" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen overflow-y-auto no-scrollbar">
        <Link href={`${orgBase}/dashboard`} className="flex items-center gap-3 px-2 group">
          <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Dashboard</span>
        </Link>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>

        <Link
          href={`${orgBase}/catalog/new`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-[9px] font-bold uppercase tracking-[0.24em] text-black"
        >
          <Sparkles size={14} />
          Novo produto
        </Link>
      </aside>

      <main className="flex-1 p-8 lg:p-12 overflow-y-auto no-scrollbar">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div className="space-y-3">
            <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C]">Venus Engine Management</Text>
            <Heading as="h1" className="text-3xl lg:text-5xl tracking-tighter uppercase leading-none">
              Estoque do catálogo
            </Heading>
            <Text className="max-w-2xl text-sm text-white/50">
              Revise quantidade total, reservado e status operacional por produto. O estoque legado continua compatível e os alertas são calculados por tenant.
            </Text>
          </div>

          <div className="flex flex-col items-end gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white/45">
              {products.length} produtos
            </span>
            <Link href={`${orgBase}/catalog/new`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-black">
              <Plus size={14} />
              Novo produto
            </Link>
          </div>
        </header>

        {searchParams?.updated ? (
          <div className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-100">Estoque atualizado com sucesso.</div>
        ) : null}

        {catalogError ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {catalogError}
          </div>
        ) : null}

        <section className="mb-8 grid gap-4 lg:grid-cols-4">
          <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-5">
            <Text className="text-[9px] uppercase tracking-[0.3em] text-white/35">Alertas</Text>
            <div className="mt-2 font-mono text-3xl font-bold">{alertCount}</div>
          </div>
          <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-5">
            <Text className="text-[9px] uppercase tracking-[0.3em] text-white/35">Críticos</Text>
            <div className="mt-2 font-mono text-3xl font-bold text-red-300">{criticalCount}</div>
          </div>
          <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-5">
            <Text className="text-[9px] uppercase tracking-[0.3em] text-white/35">Baixo estoque</Text>
            <div className="mt-2 font-mono text-3xl font-bold text-yellow-300">{lowStockCount}</div>
          </div>
          <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-5">
            <Text className="text-[9px] uppercase tracking-[0.3em] text-white/35">Sem estoque</Text>
            <div className="mt-2 font-mono text-3xl font-bold text-red-300">{outOfStockCount}</div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/40">Produtos</span>
            <Link href={`${orgBase}/catalog/new`} className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">
              Revisar com IA
            </Link>
          </div>

          {products.length ? (
            <div className="space-y-4">
              {products.map((product) => (
                <ProductCard key={product.id} orgBase={orgBase} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-[32px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/20">
                <ImageIcon size={26} />
              </div>
              <Heading as="h3" className="text-xl uppercase tracking-tight">
                Catálogo vazio
              </Heading>
              <Text className="mt-2 text-sm text-white/45">Cadastre o primeiro produto por foto para liberar o inventário operacional.</Text>
              <Link
                href={`${orgBase}/catalog/new`}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-black"
              >
                <Plus size={14} />
                Adicionar produto
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
