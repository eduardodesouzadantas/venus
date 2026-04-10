"use client";

import { use } from "react";
import { useState } from "react";
import { Sparkles, Upload, ArrowLeft, Image as ImageIcon, Save, Edit3, Target, Zap, LayoutGrid, CheckCircle2, ShoppingBag, Terminal, Plus, X } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewProductEnrichment({ params }: { params: Promise<{ slug: string }> }) {
  const [step, setStep] = useState<"upload" | "enriching" | "review">("upload");
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const { slug } = use(params);

  const handleUpload = () => {
    setStep("enriching");
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setStep("review");
      }
    }, 150);
  };

  const [enrichedData, setEnrichedData] = useState({
     name: "Blazer Lã Merino Arquitetural",
     description: "O ápice da alfaiataria executiva, desenhado para conferir autoridade imediata sem sacrificar o conforto térmico.",
     impact: "Redefina sua presença em negociações estratégicas.",
     benefit: "Estrutura inabalável com toque de lã fria merino de gramatura superfina.",
     socialEffect: "Projeta status intelectual e domínio estético.",
     styleTags: ["Quiet Luxury", "Bespoke", "Elite Minimalism"],
     profile: "CEO, Executivo de C-Level, Empreendedores de Alto Impacto"
  });

  return (
    <div className="min-h-screen bg-black text-white p-12">
      <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
         
         <header className="flex items-center justify-between">
            <Link href={`/org/${slug}/catalog`} className="flex items-center gap-3 px-4 py-2 rounded-full border border-white/5 hover:bg-white/5 transition-all text-white/40 hover:text-white group">
               <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Voltar ao Acervo</span>
            </Link>
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
               <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">AI Enrichment Pipeline</span>
            </div>
         </header>

         {step === "upload" ? (
            <section className="flex flex-col items-center justify-center space-y-12 py-20">
               <div className="text-center space-y-4 max-w-sm">
                  <Heading as="h1" className="text-4xl tracking-tighter uppercase leading-none">Cadastrar Novo Produto</Heading>
                  <Text className="text-xs text-white/30 leading-relaxed uppercase tracking-[0.2em] font-bold">Faça o upload de uma imagem clara e deixe a IA de Geração de Desejo fazer o resto.</Text>
               </div>

               <button 
                 onClick={handleUpload}
                 className="w-full max-w-xl aspect-video rounded-[60px] bg-white/[0.02] border-2 border-dashed border-white/10 flex flex-col items-center justify-center space-y-6 hover:bg-white/[0.04] hover:border-[#D4AF37]/20 transition-all group">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-[#D4AF37] group-hover:text-black transition-all">
                     <Upload size={32} />
                  </div>
                  <Text className="text-[10px] uppercase font-bold tracking-widest text-white/40">Clique ou Arraste o arquivo (JPG/PNG)</Text>
               </button>
            </section>
         ) : step === "enriching" ? (
            <section className="flex flex-col items-center justify-center py-20 space-y-12">
               <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="absolute inset-0 border-t-2 border-[#D4AF37] rounded-full animate-spin" />
                  <Sparkles className="w-10 h-10 text-[#D4AF37] animate-pulse" />
               </div>
               <div className="text-center space-y-4">
                  <Heading as="h2" className="text-3xl tracking-tighter uppercase">Enriquecimento AI em curso...</Heading>
                  <Text className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Gerando Copy Persuasiva, Mapeando Estilo e Perfil de Compra</Text>
               </div>
               <div className="w-full max-w-md space-y-3">
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-[#D4AF37] transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between items-center px-1">
                     <span className="text-[8px] uppercase tracking-widest text-white/20 font-bold">Neural Generation Active</span>
                     <span className="text-[8px] font-mono text-[#D4AF37] font-bold">{progress}%</span>
                  </div>
               </div>
            </section>
         ) : (
            <div className="grid grid-cols-3 gap-12 animate-in zoom-in-95 duration-1000">
               {/* Left: Preview */}
               <div className="col-span-1 space-y-8">
                  <div className="aspect-[3/4] rounded-[48px] overflow-hidden bg-white/5 border border-white/10 relative group">
                     <img src="https://i.pravatar.cc/600?u=new_prod" className="w-full h-full object-cover" />
                     <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[8px] font-bold uppercase tracking-widest">Original</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     {[1,2].map(i => (
                       <div key={i} className="aspect-square rounded-3xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center text-white/10">
                          <Plus size={16} />
                       </div>
                     ))}
                  </div>
               </div>

               {/* Right: Review & Edit (Part 4) */}
               <div className="col-span-2 space-y-12">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <Heading as="h3" className="text-2xl tracking-tighter uppercase">Revisão de Enriquecimento</Heading>
                        <Text className="text-[10px] text-green-500 uppercase font-bold tracking-widest flex items-center gap-2">
                           <CheckCircle2 size={12} /> Alta Probabilidade de Desejo Detectada
                        </Text>
                     </div>
                     <VenusButton onClick={() => router.push(`/org/${slug}/catalog`)} variant="solid" className="bg-white text-black h-12 px-8 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                        <Save size={16} /> Salvar Produto
                     </VenusButton>
                  </div>

                  <div className="space-y-8">
                     <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] ml-4 flex items-center gap-2 italic">
                           <Edit3 size={10} /> Sugestão de Nome Premium
                        </label>
                        <input 
                          type="text" 
                          defaultValue={enrichedData.name}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-base text-white font-serif tracking-tight focus:border-[#D4AF37]/40 outline-none transition-all" 
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 ml-4">Descrição Persuasiva AI</label>
                        <textarea 
                          defaultValue={enrichedData.description}
                          className="w-full h-32 bg-white/5 border border-white/10 rounded-[40px] p-8 text-sm text-white/80 leading-relaxed focus:border-[#D4AF37]/40 outline-none transition-all resize-none" 
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                           <label className="text-[8px] uppercase font-bold tracking-widest text-white/30 ml-4 flex items-center gap-2">
                              <Target size={10} /> Perfil do Comprador
                           </label>
                           <input type="text" defaultValue={enrichedData.profile} className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-6 text-[10px] text-white focus:border-[#D4AF37]/40 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[8px] uppercase font-bold tracking-widest text-white/30 ml-4 flex items-center gap-2">
                              <Zap size={10} /> Benefício Funcional
                           </label>
                           <input type="text" defaultValue={enrichedData.benefit} className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-6 text-[10px] text-white focus:border-[#D4AF37]/40 outline-none transition-all" />
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] flex items-center gap-2">
                              <LayoutGrid size={12} /> Tags de Estilo Geradas
                           </span>
                           <button className="text-[8px] text-white/20 uppercase font-bold hover:text-white transition-colors">+ Adicionar Tag</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {enrichedData.styleTags.map(tag => (
                             <div key={tag} className="px-4 py-2 rounded-full bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-white/60 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 group hover:border-[#D4AF37]/40 transition-all cursor-pointer">
                                {tag} <X size={10} className="hover:text-red-500 transition-colors" />
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}

      </div>
    </div>
  );
}
