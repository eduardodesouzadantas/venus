"use client";

import { use } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Edit3,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  Plus,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

export default function MerchantCatalog({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const orgBase = `/org/${slug}`;

  const navItems = [
    { href: `${orgBase}/catalog`, icon: <LayoutGrid size={16} />, label: "Acervo", active: true },
    { href: `${orgBase}/catalog/new`, icon: <Plus size={16} />, label: "Novo produto" },
    { href: `${orgBase}/whatsapp/campaigns`, icon: <Layers size={16} />, label: "Looks & bundles" },
    { href: `${orgBase}/integrations`, icon: <ImageIcon size={16} />, label: "Integrações" },
    { href: `${orgBase}/settings`, icon: <Tag size={16} />, label: "Mapeamento" },
  ];

  const products = [
    { id: "1", name: "Blazer Lã Merino", price: "R$ 2.450", status: "Enriquecido", score: 95, tags: ["Elegance", "Authority", "Winter"] },
    { id: "2", name: "Camisa Algodão Gold", price: "R$ 820", status: "Incompleto", score: 42, tags: ["Essential", "Base"], alert: true },
    { id: "3", name: "Sombra Turtleneck", price: "R$ 650", status: "Rascunho", score: 10, tags: [] },
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
      </aside>

      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between mb-16 gap-8">
          <div className="space-y-1">
            <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Venus Engine Management</Text>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">
              Gestão de Catálogo AI
            </Heading>
          </div>

          <div className="flex gap-4">
            <Link
              href={`${orgBase}/catalog/new`}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all hover:bg-white/5 hover:text-white"
            >
              Lote AI Enrichment
            </Link>
            <Link
              href={`${orgBase}/integrations`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Importar Catálogo
            </Link>
          </div>
        </header>

        <div className="space-y-8">
          <div className="flex items-center gap-4 px-4">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-[10px]">🔎</span>
              <input
                type="text"
                placeholder="Buscar produto por nome ou tag..."
                className="w-full h-14 rounded-3xl bg-white/5 border border-white/10 pl-12 pr-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all"
              />
            </div>
            <Link
              href={`${orgBase}/integrations`}
              className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors"
              aria-label="Abrir integrações"
            >
              <ChevronDown size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="p-8 rounded-[48px] bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all gap-8"
              >
                <div className="flex items-center gap-10 min-w-0">
                  <div className="w-20 h-20 rounded-[32px] bg-white/10 relative overflow-hidden group">
                    <img src={`https://i.pravatar.cc/150?u=thumb_${index}`} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImageIcon size={20} className="text-white/60" />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 min-w-0">
                    <Heading as="h3" className="text-xl tracking-tight uppercase leading-none truncate">
                      {product.name}
                    </Heading>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-white/5 text-[8px] font-bold uppercase tracking-widest text-[#D4AF37] border border-[#D4AF37]/20">
                        {product.price}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {product.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 text-[7px] text-white/20 uppercase tracking-[0.2em] font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-white/20 mb-1">Look readiness</span>
                    <div className="flex flex-col items-center">
                      <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div className={`h-full ${product.score > 80 ? "bg-[#D4AF37]" : "bg-yellow-500"} transition-all duration-1000`} style={{ width: `${product.score}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/40">{product.score}%</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`${orgBase}/catalog/new`}
                      className={`inline-flex items-center gap-2 px-6 py-4 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all active:scale-95 ${
                        product.alert
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/15"
                          : "bg-white/5 text-white/70 border-white/10 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <Sparkles size={14} />
                      {product.alert ? "Corrigir AI" : "Abrir produto"}
                    </Link>

                    <Link
                      href={`${orgBase}/catalog/new`}
                      className="inline-flex w-14 h-14 items-center justify-center rounded-full border border-white/5 text-white/20 hover:text-white hover:border-[#D4AF37]/40 transition-all"
                      aria-label={`Editar ${product.name}`}
                    >
                      <Edit3 size={18} />
                    </Link>

                    <Link
                      href={`${orgBase}/dashboard`}
                      className="inline-flex w-14 h-14 items-center justify-center rounded-full border border-white/5 text-white/20 hover:text-white hover:border-[#D4AF37]/40 transition-all"
                      aria-label={`Voltar ao painel para ${product.name}`}
                    >
                      <Eye size={18} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-10 right-10 z-50">
        <div className="p-6 rounded-[40px] bg-black/80 backdrop-blur-3xl border border-[#D4AF37]/30 shadow-2xl flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Queue Status</span>
            <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-2">
              <Sparkles size={12} /> AI Enrichment active
            </span>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${
        active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}
