"use client";

import type { ReactNode } from "react";
import { LayoutGrid, Image as ImageIcon, Sparkles, Tag, Plus, Edit3, Save, ArrowLeft, ChevronRight, ChevronDown, X, Layers, Target, ShoppingBag, Eye, Trash2 } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import Link from "next/link";

export default function MerchantCatalog({ params }: { params: { slug: string } }) {
  
  const products = [
    { id: "1", name: "Blazer Lã Merino", price: "R$ 2.450", status: "Enlisting", score: 95, tags: ["Elegance", "Authority", "Winter"] },
    { id: "2", name: "Camisa Algodão Gold", price: "R$ 820", status: "Incomplete", score: 42, tags: ["Essential", "Base"], alert: true },
    { id: "3", name: "Sombra Turtleneck", price: "R$ 650", status: "Draft", score: 10, tags: [] },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Merchant Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen overflow-y-auto no-scrollbar">
         <Link href={`/org/${params.slug}/dashboard`} className="flex items-center gap-3 px-2 group">
            <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Dashboard</span>
         </Link>

         <nav className="flex-1 space-y-2">
            <NavItem icon={<LayoutGrid size={16} />} label="Acervo" active />
            <NavItem icon={<Plus size={16} />} label="Novo Produto" />
            <NavItem icon={<Layers size={16} />} label="Looks & Bundles" />
            <NavItem icon={<ImageIcon size={16} />} label="Asset Manager" />
            <NavItem icon={<Tag size={16} />} label="Style Mapping" />
         </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
         <header className="flex items-center justify-between mb-16">
            <div className="space-y-1">
               <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Maison Elite Management</Text>
               <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">Gestão de Catálogo AI</Heading>
            </div>
            <div className="flex gap-4">
               <VenusButton variant="outline" className="border-white/10 rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-6">Lote AI Enrichment</VenusButton>
               <VenusButton variant="solid" className="bg-white text-black rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-6">Importar Catálogo</VenusButton>
            </div>
         </header>

         {/* Catalog Grid */}
         <div className="space-y-8">
            <div className="flex items-center gap-6 px-4">
               <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-[10px]">🔎</span>
                  <input type="text" placeholder="Buscar produto por nome ou tag..." className="w-full h-14 rounded-3xl bg-white/5 border border-white/10 pl-12 pr-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all" />
               </div>
               <button className="h-14 w-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40"><ChevronDown size={18} /></button>
            </div>

            <div className="grid grid-cols-1 gap-4">
               {products.map((p) => (
                 <div key={p.id} className="p-8 rounded-[48px] bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-10">
                       <div className="w-20 h-20 rounded-[32px] bg-white/10 relative overflow-hidden group">
                          <img src={`https://i.pravatar.cc/150?u=thumb_${p.id}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <ImageIcon size={20} className="text-white/60" />
                          </div>
                       </div>
                       <div className="flex flex-col space-y-2">
                          <Heading as="h3" className="text-xl tracking-tight uppercase leading-none">{p.name}</Heading>
                          <div className="flex items-center gap-3">
                             <span className="px-3 py-1 rounded-full bg-white/5 text-[8px] font-bold uppercase tracking-widest text-[#D4AF37] border border-[#D4AF37]/20">{p.price}</span>
                             <div className="flex gap-1">
                                {p.tags.map(t => (
                                  <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 text-[7px] text-white/20 uppercase tracking-[0.2em] font-bold">{t}</span>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-12">
                       <div className="flex flex-col items-center">
                          <span className="text-[9px] uppercase font-bold tracking-widest text-white/20 mb-1">Look Readiness</span>
                          <div className="flex flex-col items-center">
                             <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                                <div className={`h-full ${p.score > 80 ? "bg-[#D4AF37]" : "bg-yellow-500"} transition-all duration-1000`} style={{ width: `${p.score}%` }} />
                             </div>
                             <span className="text-[10px] font-mono text-white/40">{p.score}%</span>
                          </div>
                       </div>

                       <div className="flex gap-3">
                          {p.alert && (
                             <button className="px-6 py-4 rounded-full bg-yellow-500/10 text-yellow-500 text-[9px] font-bold uppercase tracking-widest border border-yellow-500/20 active:scale-95 transition-all flex items-center gap-2">
                                <Sparkles size={14} /> Corrigir AI
                             </button>
                          )}
                          <button className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:border-[#D4AF37]/40 transition-all">
                             <Edit3 size={18} />
                          </button>
                          <button className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-red-500/40 hover:border-red-500/20 transition-all">
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </main>

      {/* Floating AI Status Selector */}
      <div className="fixed bottom-10 right-10 z-50">
         <div className="p-6 rounded-[40px] bg-black/80 backdrop-blur-3xl border border-[#D4AF37]/30 shadow-2xl flex items-center gap-6">
            <div className="flex flex-col">
               <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Queue Status</span>
               <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-2"><Sparkles size={12} /> AI Enrichment active</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex -space-x-3">
               {[1,2,3].map(i => (
                 <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-white/10" />
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"}`}>
       {icon}
       <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
