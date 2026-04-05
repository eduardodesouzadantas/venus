"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { LookCardSwipeable } from "@/components/ui/LookCardSwipeable";
import { SavedProfileToast } from "@/components/ui/SavedProfileToast";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
import { SocialShareActions } from "@/components/ui/SocialShareActions";
import { registerSocialAction } from "@/lib/social/economy";
import { trackPotentialAbandonment } from "@/lib/whatsapp/AutomationEngine";
import { buildWhatsAppHandoffMessage, buildWhatsAppHandoffPayload, buildWhatsAppHandoffUrl } from "@/lib/whatsapp/handoff";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import type { BehaviorStatsSummary } from "@/lib/analytics/tracker";
import type { UserStats } from "@/lib/ai/orchestrator";
import type { LookData, ResultPayload } from "@/types/result";

import { Watch, ArrowRight, Sparkles, Target, LayoutGrid, Star, PackageCheck, History, BrainCircuit, Activity, Bookmark } from "lucide-react";
import { getEngagedIds, getStatsSummary } from "@/lib/analytics/tracker";
import { orchestrateExperience } from "@/lib/ai/orchestrator";
import { useSearchParams } from "next/navigation";

function ResultDashboardContent() {
  const searchParams = useSearchParams();
  const isSaved = searchParams.get("saved") === "true";
  const id = searchParams.get("id");
  const hardCapOperation = id?.startsWith("HARD_CAP_BLOCKED") ? id.split(":")[1] || "saved_result_generation" : null;
  const tenantBlockReason = id?.startsWith("TENANT_BLOCKED") ? id.split(":")[1] || "tenant_not_found" : null;
  const { data: onboardingData } = useOnboarding();

  // State for AI Orchestration
  const [engagedLookIds, setEngagedLookIds] = React.useState<string[]>([]);
  const [statsSummary, setStatsSummary] = React.useState<BehaviorStatsSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isHandoffLoading, setIsHandoffLoading] = React.useState(false);

  React.useEffect(() => {
    setEngagedLookIds(getEngagedIds('look'));
    setStatsSummary(getStatsSummary());
  }, []);

  // AI Abandonment Tracking
  React.useEffect(() => {
    if (statsSummary && onboardingData.contact?.phone) {
       trackPotentialAbandonment(statsSummary, onboardingData.contact);
    }
  }, [statsSummary, onboardingData.contact]);

  // Auto-open modal for unsaved users after a delay
  React.useEffect(() => {
    if (!isSaved && !onboardingData.contact?.phone) {
      const timer = setTimeout(() => setIsModalOpen(true), 15000); // 15s delay
      return () => clearTimeout(timer);
    }
  }, [isSaved, onboardingData.contact]);

  // Fallback mock data
  const mockResult: ResultPayload = {
    hero: { 
      dominantStyle: "Minimalismo de Elite",
      subtitle: "Uma estética baseada em linhas puras, contraste absoluto e autoridade silenciosa.",
      coverImageUrl: ""
    },
    palette: { 
      family: "Inverno Profundo",
      description: "Paleta usada para reforcar contraste, limpeza e presenca.",
      contrast: "Alto",
      colors: [
        { hex: "#000000", name: "Preto Absoluto" },
        { hex: "#FFFFFF", name: "Branco Óptico" },
        { hex: "#2C3E50", name: "Azul Meia-Noite" }
      ],
      metal: "Prata"
    },
    diagnostic: {
      currentPerception: "Ruido visual e falta de verticalidade na leitura geral.",
      desiredGoal: "Projetar liderança e clareza mental.",
      gapSolution: "Remover ruídos visuais e focar em tecidos estruturados."
    },
    bodyVisagism: {
      shoulders: "Ombros estruturados para ampliar a base de confiança.",
      face: "Linhas retas para reforçar o foco e determinação.",
      generalFit: "Slim fit arquitetural."
    },
    accessories: {
      scale: "Grande & Minimalista",
      focalPoint: "Punhos e Pescoço",
      advice: "Evite excessos; um único ponto de luz é o suficiente."
    },
    looks: [
      {
        id: "1",
        name: "O Arquiteto do Amanhã",
        intention: "Ideal para reuniões de alta cúpula ou negociações decisivas.",
        type: "Híbrido Premium",
        explanation: "Este look utiliza a geometria do blazer italiano para criar uma silhueta inabalável.",
        isDailyPick: true,
        items: [
          { 
            id: "1", 
            brand: "Bespoke Lab", 
            name: "Blazer Estruturado em Lã", 
            photoUrl: "https://images.unsplash.com/photo-1594932224491-bb24dcafe277?q=80&w=600&auto=format",
            isBestseller: true,
            images: [
              "https://images.unsplash.com/photo-1594932224491-bb24dcafe277?q=80&w=600&auto=format",
              "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?q=80&w=600&auto=format",
              "https://images.unsplash.com/photo-1598808503494-3f1910243265?q=80&w=600&auto=format"
            ],
            impactLine: "Essa peça redefine sua presença imediatamente.",
            functionalBenefit: "Estrutura seus ombros e cria uma silhueta dominante.",
            socialEffect: "Transmite autoridade sem esforço.",
            contextOfUse: "Perfeito para reuniões estratégicas ou eventos onde presença importa."
          },
          { 
            id: "2", 
            brand: "Venus Essential", 
            name: "Camisa Algodão Egípcio", 
            photoUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=600&auto=format",
            impactLine: "A base impecável para qualquer negociação de alto nível.",
            functionalBenefit: "Toque acetinado que mantém o frescor e a elegância o dia todo.",
            socialEffect: "Indica atenção aos detalhes e padrão de excelência.",
            contextOfUse: "A camada fundamental sob o blazer de autoridade."
          }
        ],
        accessories: ["Relógio Slim Prata", "Anel de Assinatura"],
        whenToWear: "Eventos Executivos"
      },
      {
        id: "2",
        name: "Sombra Contemporânea",
        intention: "Impacto visual máximo com esforço mínimo.",
        type: "Expansão Direcionada",
        popularityRank: 1,
        explanation: "O all-black com diferentes texturas comunica profundidade e mistério sob controle.",
        items: [
          { 
            id: "3", 
            brand: "Noir Concept", 
            name: "Turtleneck em Cashmere", 
            photoUrl: "https://images.unsplash.com/photo-1614676466623-f1f9e0d1213d?q=80&w=600&auto=format",
            impactLine: "O ápice do luxo silencioso e sofisticação intelectual.",
            functionalBenefit: "O cashmere isola e estrutura sem pesar, mantendo a verticalidade.",
            socialEffect: "Cria um ar de mistério e competência inquestionável.",
            contextOfUse: "Jantares decisivos ou apresentações criativas de alto impacto."
          },
          { 
            id: "4", 
            brand: "Tailor Dark", 
            name: "Calça de Alfaiataria Moderna", 
            photoUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format",
            impactLine: "Corte cirúrgico para uma movimentação de autoridade.",
            functionalBenefit: "Ajuste preciso que alonga as pernas e reforça a postura ereta.",
            socialEffect: "Transmite estabilidade e rigor estético.",
            contextOfUse: "O par perfeito para peças de topo estruturadas."
          }
        ],
        accessories: ["Óculos de Sol Estruturado"],
        whenToWear: "Jantares Exclusivos"
      }
    ],
    toAvoid: [
      "Estampas orgânicas ou florais",
      "Roupas excessivamente largas (oversized casual)",
      "Cores pastéis que apagam seu contraste facial"
    ]
  };

  // STEP 1 & 3: AI ORCHESTRATION RECO (REORDERING & INSIGHT)
  const { rankedLooks, aiInsight } = useMemo(() => {
    const rawStats = statsSummary || { looks: {}, products: {} };
    const looksEntries = Object.entries(rawStats.looks) as Array<[string, Record<string, number>]>;
    const normalized = {
      views: Object.fromEntries(looksEntries.map(([id, data]) => [id, data.view || 0])),
      clicks: Object.fromEntries(looksEntries.map(([id, data]) => [id, data.click || 0])),
      shares: {},
      bundles: Object.fromEntries(looksEntries.map(([id, data]) => [id, data.complete_look || 0])),
      timeSpent: 130, // Mocked
      tryOnUsed: engagedLookIds.length > 0
    } satisfies UserStats;

    return orchestrateExperience(normalized, mockResult.looks || []);
  }, [mockResult.looks, statsSummary, engagedLookIds]);

  const featuredShareLook = rankedLooks?.[0] || mockResult.looks?.[0];

  const handleWhatsAppHandoff = async () => {
    const topLooks = (rankedLooks?.length ? rankedLooks : mockResult.looks).slice(0, 2);
    const handoffInput = {
      resultId: id,
      contactName: onboardingData.contact?.name || "",
      contactPhone: onboardingData.contact?.phone || "",
      styleIdentity: mockResult.hero.dominantStyle,
      dominantStyle: mockResult.hero.dominantStyle,
      imageGoal: onboardingData.intent.imageGoal || mockResult.diagnostic.desiredGoal,
      paletteFamily: mockResult.palette.family,
      lookSummary: topLooks,
      intentScore: aiInsight.intentScore,
      fit: onboardingData.body.fit || "",
      metal: onboardingData.colors.metal || mockResult.palette.metal,
    };

    const message = buildWhatsAppHandoffMessage(handoffInput);
    const url = buildWhatsAppHandoffUrl(message);

    if (id) {
      const payload = buildWhatsAppHandoffPayload(handoffInput);
      const body = JSON.stringify({ resultId: id, payload });

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/whatsapp-handoff", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/whatsapp-handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    }

    registerSocialAction("advance");
    setIsHandoffLoading(true);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => setIsHandoffLoading(false), 1200);
  };

  if (hardCapOperation) {
    const title =
      hardCapOperation === "catalog_product_creation"
        ? "Limite do catálogo atingido"
        : "Limite de geração atingido";

    const description =
      hardCapOperation === "catalog_product_creation"
        ? "A criação deste produto foi bloqueada porque a org atingiu o limite server-side do plano atual."
        : "A geração deste dossiê foi bloqueada porque a org atingiu o limite server-side do plano atual.";

    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-lg p-8 rounded-[32px] bg-red-500/10 border border-red-500/20 space-y-4">
          <Text className="text-[10px] uppercase tracking-[0.35em] text-red-400 font-bold">Hard cap server-side</Text>
          <h1 className="text-2xl font-serif uppercase tracking-tighter">{title}</h1>
          <Text className="text-sm text-white/70">{description}</Text>
          <Text className="text-xs text-white/40">
            O bloqueio foi auditado no tenant core e a operação não foi executada.
          </Text>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/onboarding/body">
              <VenusButton variant="solid" className="w-full sm:w-auto bg-white text-black">
                Recomeçar consulta
              </VenusButton>
            </Link>
            <Link href="/">
              <VenusButton variant="outline" className="w-full sm:w-auto border-white/10">
                Voltar ao início
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (tenantBlockReason) {
    const title =
      tenantBlockReason === "kill_switch_on"
        ? "Kill switch ativo"
        : tenantBlockReason === "suspended"
          ? "Org suspensa"
          : tenantBlockReason === "blocked"
            ? "Org bloqueada"
            : "Tenant sem acesso";

    const description =
      tenantBlockReason === "kill_switch_on"
        ? "A operação foi bloqueada porque o tenant está com kill switch ativo."
        : tenantBlockReason === "suspended"
          ? "A operação foi bloqueada porque a org está suspensa."
          : tenantBlockReason === "blocked"
            ? "A operação foi bloqueada porque a org está bloqueada."
            : "A operação foi bloqueada porque o tenant não pôde ser validado.";

    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-lg p-8 rounded-[32px] bg-red-500/10 border border-red-500/20 space-y-4">
          <Text className="text-[10px] uppercase tracking-[0.35em] text-red-400 font-bold">Tenant operational block</Text>
          <h1 className="text-2xl font-serif uppercase tracking-tighter">{title}</h1>
          <Text className="text-sm text-white/70">{description}</Text>
          <Text className="text-xs text-white/40">
            O bloqueio foi auditado em tenant core e a operação não foi executada.
          </Text>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/onboarding/body">
              <VenusButton variant="solid" className="w-full sm:w-auto bg-white text-black">
                Recomeçar consulta
              </VenusButton>
            </Link>
            <Link href="/">
              <VenusButton variant="outline" className="w-full sm:w-auto border-white/10">
                Voltar ao início
              </VenusButton>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!id) {
     return (
       <div className="flex flex-col h-screen items-center justify-center bg-black">
         <Text className="text-red-500 mb-4">Dossiê não encontrado ou inspirado.</Text>
         <Link href="/"><VenusButton variant="solid">Recomeçar Consulta</VenusButton></Link>
       </div>
     )
  }

  return (
    <div className={`flex flex-col min-h-screen ${aiInsight.intensity === 'HIGH' ? "bg-black" : "bg-[#0A0A0A]"} overflow-x-hidden pb-48 transition-colors duration-1000`}>
      
      {isSaved && <SavedProfileToast />}

      {/* AI Orchestration Overlay - Insight (Part 1) */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-full backdrop-blur-3xl bg-black/40 border border-[#D4AF37]/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
         <div className="relative">
            <Activity className="w-3 h-3 text-[#D4AF37] animate-pulse" />
            <div className="absolute inset-0 bg-[#D4AF37]/20 blur-md rounded-full" />
         </div>
         <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37]">Intent Predictor: {aiInsight.intentScore}%</span>
         <div className="w-[1px] h-3 bg-white/10" />
         <BrainCircuit className="w-3 h-3 text-white/40" />
         <span className="text-[9px] uppercase font-bold tracking-widest text-white/40">Mode: {aiInsight.strategy.mode}</span>
      </div>

      {/* Hero Section (Part 8: Friction Removal for High Intent) */}
      <div className={`relative px-6 pt-24 pb-12 overflow-hidden transition-all ${aiInsight.intensity === 'HIGH' ? "opacity-80 scale-95" : ""}`}>
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#D4AF37]/10 to-transparent pointer-events-none" />
         
         <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-2">
               <div className="w-px h-6 bg-[#D4AF37]" />
               <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">
                  {aiInsight.intensity === 'HIGH' ? "Oferta Exclusiva Ativa" : "Seu Dossiê Exclusivo"}
               </span>
            </div>
            <h1 className="text-4xl font-serif tracking-tighter uppercase leading-none">
                {aiInsight.intensity === 'HIGH' ? "Transformação Imediata" : mockResult.hero.dominantStyle}
            </h1>
            <Text className="text-sm text-white/60 leading-relaxed max-w-[280px]">
               {aiInsight.strategy.trigger}
            </Text>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
               <VenusButton
                 onClick={handleWhatsAppHandoff}
                 disabled={isHandoffLoading}
                 className="w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 uppercase tracking-[0.35em] text-[9px] font-bold h-12 px-6"
               >
                 {isHandoffLoading ? "Abrindo WhatsApp..." : "Quero ver isso no WhatsApp"}
               </VenusButton>
               <Link href="#looks" className="w-full sm:w-auto">
                 <VenusButton variant="outline" className="w-full sm:w-auto border-white/10 uppercase tracking-[0.35em] text-[9px] font-bold h-12 px-6">
                    Ver meus looks
                 </VenusButton>
               </Link>
            </div>
            {featuredShareLook && (
              <div className="pt-4">
                <SocialShareActions
                  look={featuredShareLook}
                  styleIdentity={mockResult.hero.dominantStyle}
                  imageGoal={onboardingData.intent.imageGoal || mockResult.diagnostic.desiredGoal}
                  intentScore={aiInsight.intentScore}
                  brandName="Maison Elite"
                  appName="Venus Engine"
                />
              </div>
            )}
         </div>

         {/* Visual Stats Bar */}
         <div className="mt-10 flex gap-6 overflow-x-auto no-scrollbar pb-2">
            <div className="flex-shrink-0 flex flex-col gap-1">
               <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Paleta</span>
               <span className="text-[10px] uppercase font-bold">{mockResult.palette.family}</span>
            </div>
            <div className="flex-shrink-0 flex flex-col gap-1">
               <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Contraste</span>
               <span className="text-[10px] uppercase font-bold">{mockResult.palette.contrast}</span>
            </div>
            <div className="flex-shrink-0 flex flex-col gap-1">
               <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Metal Ideal</span>
               <span className="text-[10px] uppercase font-bold">{mockResult.palette.metal}</span>
            </div>
         </div>
      </div>

      <div className="px-6 space-y-16">
        {/* Diagnostic Section */}
        <section className="space-y-6">
           <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Diretrizes de Poder</span>
           </div>
           <div className="grid grid-cols-1 gap-4">
              <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 space-y-3">
                 <span className="text-[9px] uppercase font-bold tracking-widest text-white/30">Meta Desejada</span>
                 <Text className="text-sm text-white/90 italic">&quot;{mockResult.diagnostic.desiredGoal}&quot;</Text>
              </div>
              <div className="p-6 rounded-[32px] bg-[#D4AF37]/5 border border-[#D4AF37]/10 space-y-3">
                 <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37]">Solução de Gap Visual</span>
                 <Text className="text-sm text-white/90">{mockResult.diagnostic.gapSolution}</Text>
              </div>
           </div>
        </section>

        {/* Part 8: Friction Removal for High Intent */}
        {aiInsight.intensity !== 'HIGH' && (
           <div className="relative group animate-in fade-in duration-1000">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#D4AF37] transition-colors"><LayoutGrid size={16} /></div>
              <input 
                type="text" 
                placeholder="Explorar outras categorias de estilo..." 
                className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-full px-16 text-[10px] uppercase tracking-widest text-white focus:border-[#D4AF37]/40 outline-none transition-all placeholder:text-white/20" 
              />
           </div>
        )}

        {/* Color Palette Display */}
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <LayoutGrid className="w-4 h-4 text-white/40" />
                 <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Suas Cores de Autoridade</span>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37]">Inverno Profundo</span>
           </div>
           
           <div className="flex gap-3 h-20 overflow-hidden rounded-[32px]">
              {mockResult.palette.colors.map((color, i: number) => (
                <div key={i} className="flex-1 transition-all hover:flex-[2] relative group" style={{ backgroundColor: color.hex }}>
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] uppercase font-bold tracking-widest text-white">{color.name}</span>
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* The Recommender AI Ranked Looks (Step 10: Behavior-driven reordering) */}
        <section id="looks" className="space-y-8">
           <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2">Sua Curadoria Inteligente</span>
                 </div>
                 {aiInsight.intentScore > 60 && (
                   <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[8px] font-bold uppercase tracking-widest animate-pulse">Intenção Máxima: Reserva Prioritária</span>
                 )}
              </div>
           </div>
           
           <div className="space-y-16">
              {rankedLooks.map((look: LookData, i: number) => (
                <div key={look.id} className="relative">
                   {/* Step 9: Micro Social Proof */}
                   {(i === 0 || aiInsight.intensity === 'HIGH') && (
                     <div className="absolute -top-6 left-2 flex items-center gap-2">
                        <Star size={10} className="text-[#D4AF37]" />
                        <span className="text-[8px] uppercase font-bold tracking-widest text-white/40">Perfis semelhantes ao seu escolhem este estilo · Recomendado</span>
                     </div>
                   )}
                   <LookCardSwipeable 
                      look={look} 
                      strategy={aiInsight.strategy}
                      intensity={aiInsight.intensity}
                   />
                </div>
              ))}
           </div>
        </section>

        {/* Visagism / Structure Section */}
        <section className="space-y-8">
           <div className="flex items-center gap-3">
              <PackageCheck className="w-4 h-4 text-white/40" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Arquitetura de Silhueta</span>
           </div>
           <div className="space-y-4">
              <div className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 group">
                <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2">Construção de Ombros</Text>
                <Text className="text-sm leading-relaxed text-white/80">{mockResult.bodyVisagism.shoulders}</Text>
              </div>
              <div className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 group">
                <Text className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2">Estrutura Facial</Text>
                <Text className="text-sm leading-relaxed text-white/80">{mockResult.bodyVisagism.face}</Text>
              </div>
           </div>
        </section>

        {/* Avoid List */}
        <section className="space-y-6">
           <div className="flex items-center gap-3">
              <History className="w-4 h-4 text-red-500/40" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">O que evitar (Gap Killers)</span>
           </div>
           <div className="space-y-3">
              {mockResult.toAvoid.map((item: string, i: number) => (
                <div key={i} className="flex items-center gap-4 py-4 border-b border-white/5 group">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500/20 group-hover:bg-red-500 transition-colors" />
                   <Text className="text-xs text-white/40 group-hover:text-white/80 transition-colors">{item}</Text>
                </div>
              ))}
           </div>
        </section>

        {/* Final CTA / Social Proof Ref */}
        <div className="pt-20 pb-10 flex flex-col items-center text-center space-y-6">
           <Text className="text-[9px] uppercase tracking-[0.5em] text-white/20 font-bold">Venus Engine v2.0 AI</Text>
           <Link href="/admin/proof" className="group">
              <div className="flex items-center gap-2 text-[#D4AF37] opacity-40 group-hover:opacity-100 transition-opacity">
                 <Star size={12} fill="currentColor" />
                 <span className="text-[10px] uppercase font-bold tracking-widest underline underline-offset-4">Ver Prova de Faturamento</span>
              </div>
           </Link>
        </div>

      </div>

      {/* Floating Accessory Hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-4 w-[calc(100%-48px)] max-w-sm">
         {!onboardingData.contact?.phone && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-4 rounded-full bg-[#D4AF37] text-black flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all w-full mb-2"
            >
               <Bookmark size={16} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Salvar Meus Resultados</span>
            </button>
         )}
         <div className="p-4 rounded-full bg-white text-black flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] transition-transform cursor-pointer overflow-hidden relative group w-full">
            <div className="absolute inset-0 bg-[#D4AF37] translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <div className="flex items-center gap-3 relative z-10">
               <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                  <Watch size={16} />
               </div>
               <span className="text-[10px] font-bold uppercase tracking-widest">Ver Acessórios Recomendados</span>
            </div>
            <ArrowRight size={16} className="relative z-10" />
         </div>
      </div>

      <SaveResultsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        stats={statsSummary}
      />
    </div>
  );
}

export default function ResultDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Carregando...</div>}>
      <ResultDashboardContent />
    </Suspense>
  );
}
