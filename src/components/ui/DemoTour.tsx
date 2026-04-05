"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, X, ShieldCheck, Zap, TrendingUp, ShoppingBag, MousePointer2 } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";

interface DemoStep {
  id: string;
  path: string;
  title: string;
  description: string;
  value: string;
  icon: React.ReactNode;
  selector?: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: "onboarding",
    path: "/onboarding",
    title: "Mapeamento de Desejo",
    description: "Nossa IA identifica o biotipo e a intenção do cliente antes mesmo de mostrar o produto.",
    value: "Reduz a indecisão na entrada do funil.",
    icon: <Zap className="w-5 h-5 text-[#D4AF37]" />
  },
  {
    id: "result",
    path: "/result",
    title: "Dossiê de Autoridade",
    description: "Transformamos o catálogo em uma curadoria personalizada de alto valor.",
    value: "Gera desejo imediato e percepção de exclusividade.",
    icon: <Sparkles className="w-5 h-5 text-[#D4AF37]" />
  },
  {
    id: "bundle",
    path: "/result",
    title: "Conversão de Bundle",
    description: "Destaque looks completos para aumentar o valor da venda automaticamente.",
    value: "Aumenta o ticket médio em até 3.2x.",
    icon: <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />
  },
  {
    id: "tryon",
    path: "/result",
    title: "Efeito de Posse Virtual",
    description: "O cliente se vê usando o look, removendo a barreira final de dúvida.",
    value: "Aumenta a conversão em 45% via Try-On.",
    icon: <MousePointer2 className="w-5 h-5 text-[#D4AF37]" />
  },
  {
    id: "dashboard",
    path: "/admin/performance",
    title: "Inteligência Merchant",
    description: "Acompanhe exatamente o que gera desejo e onde estão suas oportunidades de lucro.",
    value: "Decisões baseadas em dados reais de comportamento.",
    icon: <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
  }
];

export function DemoTour() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";
  const pathname = usePathname();
  const router = useRouter();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setIsVisible(true);
      // Auto-match step to current path
      const stepIndex = DEMO_STEPS.findIndex(s => s.path === pathname);
      if (stepIndex !== -1) setCurrentStepIndex(stepIndex);
    }
  }, [isDemo, pathname]);

  if (!isDemo || !isVisible) return null;

  const step = DEMO_STEPS[currentStepIndex];
  const isLast = currentStepIndex === DEMO_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      router.push("/admin/proof?demo=true");
      return;
    }
    const nextStep = DEMO_STEPS[currentStepIndex + 1];
    setCurrentStepIndex(currentStepIndex + 1);
    router.push(`${nextStep.path}?demo=true&id=MOCK_ID`);
  };

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-sm z-[300] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 rounded-[48px] bg-black/80 backdrop-blur-3xl border border-[#D4AF37]/30 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-6 opacity-10">
            {step.icon}
         </div>
         
         <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,1)]" />
                  <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Demo Guided Tour</span>
               </div>
               <button onClick={() => setIsVisible(false)} className="text-white/20 hover:text-white transition-colors">
                  <X size={16} />
               </button>
            </div>

            <div className="space-y-2">
               <Heading as="h4" className="text-xl tracking-tighter uppercase">{step.title}</Heading>
               <Text className="text-sm text-white/80 leading-relaxed">
                  {step.description}
               </Text>
            </div>

            <div className="p-4 rounded-3xl bg-[#D4AF37]/5 border border-[#D4AF37]/20">
               <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] text-[#D4AF37] uppercase font-bold tracking-widest">Impacto Comercial</span>
                     <Text className="text-xs text-white/90 font-medium leading-snug">{step.value}</Text>
                  </div>
               </div>
            </div>

            <VenusButton onClick={handleNext} variant="solid" className="w-full py-6 h-auto bg-white text-black text-[11px] font-bold uppercase tracking-[0.4em] rounded-full shadow-2xl active:scale-95 transition-all">
               {isLast ? "Ver Prova de Faturamento" : "Explorar Próximo Recurso"}
               <ArrowRight className="w-4 h-4 ml-2 group-active:translate-x-1 transition-transform" />
            </VenusButton>

            <div className="flex justify-center gap-1.5">
               {DEMO_STEPS.map((_, i) => (
                 <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === currentStepIndex ? "w-8 bg-[#D4AF37]" : "w-1 bg-white/10"}`} />
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
