"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { processAndPersistLead } from "@/lib/recommendation/actions";

const PHASES = [
  "Iniciando Motor Híbrido...",
  "Lendo acervo do seu Onboarding...",
  "Analisando geometria corporal...",
  "Cruzando com tendências e Open AI...",
  "Sintetizando Visagismo...",
  "Definindo Motores de Acessório...",
  "Dossiê Próximo da Conclusão..."
];

export default function ProcessingPage() {
  const router = useRouter();
  const { data } = useOnboarding();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const isGenerating = useRef(false);

  useEffect(() => {
    // Altera o texto visual a cada 1.5s enquanto o Server processa a carga real
    const timer = setInterval(() => {
      setPhaseIndex((p) => (p < PHASES.length - 1 ? p + 1 : p));
    }, 1500); 

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!data || isGenerating.current) return;
    
    // Começa a geração real do Dossiê na Server Action Pela Primeira Vez 
    isGenerating.current = true;
    
    // Alivia absurdamente o Payload para o Edge Server não crachar (removemos o base64 brutal)
    const strippedData = { ...data };
    strippedData.scanner = {
      ...data.scanner,
      facePhoto: data.scanner.facePhoto ? "Foto Enviada (String stripped frontend)" : "",
      bodyPhoto: data.scanner.bodyPhoto ? "Foto Enviada (String stripped frontend)" : ""
    };
    
    processAndPersistLead(strippedData).then((dbReferenceId) => {
      // Quando a Server Action de IA acabar e for salva (em 5~15s), chuta direto para a URL com id
      router.push(`/result?id=${dbReferenceId}`);
    }).catch((e) => {
       console.error("Critical Failure:", e);
       // Passamos um parametro de erro forçado caso o servidor exploda por env missing ou network
       router.push("/result?id=MOCK_DB_FAIL");
    });
    
  }, [data, router]);

  return (
    <div className="flex flex-col min-h-screen p-6 items-center justify-center relative bg-black overflow-hidden z-0">
      {/* Background Effect */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="w-[150vw] h-[150vw] max-w-[800px] max-h-[800px] border border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
        <div className="absolute w-[120vw] h-[120vw] max-w-[600px] max-h-[600px] border border-[#D4AF37]/20 rounded-full animate-[spin_8s_linear_infinite_reverse]" />
      </div>

      <div className="z-10 bg-white/5 backdrop-blur-[30px] p-8 rounded-full border border-white/10 shadow-[0_0_50px_rgba(212,175,55,0.1)] flex items-center justify-center mb-10 w-40 h-40">
        <svg 
          className="w-16 h-16 text-[#D4AF37] animate-pulse" 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="z-10 text-center w-full max-w-[300px]">
        <Heading as="h4" className="text-[#D4AF37] mb-2 font-serif text-lg tracking-widest transition-opacity duration-300">
          VÊNUS ENGINE CORE
        </Heading>
        {PHASES.map((phase, i) => (
          <Text 
            key={i}
            className={`font-mono text-xs mt-3 transition-opacity duration-500 absolute w-full left-0 ${
               i === phaseIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {phase}
          </Text>
        ))}
      </div>
    </div>
  );
}
