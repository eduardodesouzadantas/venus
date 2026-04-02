import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResultPayload } from "@/types/result";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { VenusButton } from "@/components/ui/VenusButton";
import { PaletteChip } from "@/components/ui/PaletteChip";
import { LookCardSwipeable } from "@/components/ui/LookCardSwipeable";
import { BentoGridBlock } from "@/components/ui/BentoGridBlock";
import { AccordionList } from "@/components/ui/AccordionList";

import { CheckCircle2, UserCircle2, Watch } from "lucide-react";

export default async function ResultDashboardPage({ searchParams }: { searchParams: { id?: string, saved?: string } }) {
  const isSaved = searchParams.saved === "true";
  const id = searchParams.id;

  if (!id) {
     return (
       <div className="flex flex-col h-screen items-center justify-center bg-black">
         <Text className="text-red-500 mb-4">Dossiê não encontrado ou inspirado.</Text>
         <Link href="/"><VenusButton variant="solid">Recomeçar Consulta</VenusButton></Link>
       </div>
     )
  }

  let data = null;
  let error = null;

  try {
    const supabase = await createClient();
    const res = await supabase.from("saved_results").select("payload").eq("id", id).single();
    data = res.data;
    error = res.error;
  } catch (err) {
    console.warn("DB connection simulated failure", err);
  }

  // Se DB falhar ou ID inválido, e for fallback de mock, usamos mock simulado pra não congelar o Front
  if ((error || !data) && id === "MOCK_DB_FAIL") {
    // Injecting fallback data so the demo can proceed visually
    data = {
      payload: {
        finalResult: {
           hero: { dominantStyle: "Estilo Simulado MVP" },
           palette: { colors: [] },
           diagnostic: {},
           bodyVisagism: {},
           accessories: {},
           looks: [],
           toAvoid: []
        }
      }
    }
  } else if (error || !data) {
    return (
       <div className="flex flex-col h-screen items-center justify-center bg-black">
         <Text className="text-red-500 mb-4">A chave desse Dossiê é inválida.</Text>
         <Link href="/"><VenusButton variant="solid">Recomeçar Consulta</VenusButton></Link>
       </div>
     )
  }

  const result = data.payload?.finalResult as Partial<ResultPayload>;

  // Defenses against partial AI schemas
  const dominantStyle = result?.hero?.dominantStyle || "Assinatura Personalizada";
  const subtitle = result?.hero?.subtitle || "Uma estética alinhada à sua intenção central.";
  const diagnosticGoal = result?.diagnostic?.desiredGoal || "Projeção de imagem intencional.";
  const diagnosticGap = result?.diagnostic?.gapSolution || "Vamos alinhar o viés do seu guarda-roupa.";
  const paletteFamily = result?.palette?.family || "Paleta de Cores Singular";
  const paletteContrast = result?.palette?.contrast || "Médio";
  const paletteColors = result?.palette?.colors || [];
  const paletteMetal = result?.palette?.metal || "Metal Misto";
  const looksArray = result?.looks || [];
  const archShoulders = result?.bodyVisagism?.shoulders || "Respeite as linhas estruturais do seu biotipo.";
  const archFace = result?.bodyVisagism?.face || "Harmonização aplicada aos seus formatos dominantes.";
  const archScale = result?.accessories?.scale || "Escala Proporcional";
  const archFocal = result?.accessories?.focalPoint || "Foco estratégico para disfarçar pontos fracos.";
  const archAdvice = result?.accessories?.advice || "";
  const avoidanceList = result?.toAvoid || ["Cortes aleatórios fora da modelagem indicada."];

  return (
    <div className="flex flex-col min-h-screen bg-black overflow-x-hidden pb-40">
      
      {isSaved && (
        <div className="fixed top-0 left-0 w-full bg-[#D4AF37] text-black text-xs font-bold py-2 text-center z-50 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Perfil Visual Salvo com Sucesso! 
        </div>
      )}

      {/* Hero */}
      <div className="relative h-[80vh] w-full flex flex-col items-center justify-end pb-16 px-6 bg-gradient-to-t from-black via-[#1A1A1A]/40 to-black z-10 overflow-hidden">
        <div className="absolute inset-0 z-[-1] bg-[#0A0A0A]" /> 
        <div className="w-12 h-[1px] bg-[#D4AF37] mb-6 shadow-[0_0_15px_rgba(212,175,55,1)]" />
        <span className="text-[10px] tracking-[0.3em] font-mono text-[#D4AF37] uppercase mb-4">Sua Assinatura</span>
        
        <Heading as="h1" className="text-center drop-shadow-2xl leading-none text-white break-words">
          {dominantStyle}
        </Heading>
        
        <Text className="text-center mt-6 text-white/60 max-w-[80%] font-light">
          {subtitle}
        </Text>
      </div>

      {/* Empatia Visual */}
      <div className="px-4 -mt-8 relative z-20">
        <GlassContainer className="p-6 border-l-2 border-l-[#D4AF37] bg-black/60 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-[#D4AF37] w-5 h-5" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4AF37]">Raio-X de Estilo Atual</span>
          </div>
          <Text className="text-sm leading-relaxed text-white/90">
            {diagnosticGoal} {diagnosticGap}
          </Text>
        </GlassContainer>
      </div>

      {/* Paleta Ideal */}
      <div className="mt-16 px-6">
        <Heading as="h3" className="mb-2">A Física da Luz</Heading>
        <Text className="text-white/40 text-xs mb-8">{paletteFamily} • Contraste {paletteContrast}</Text>
        
        {paletteColors.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
            {paletteColors.map((color, i) => (
              <PaletteChip key={`${color?.hex}-${i}`} hex={color?.hex || "#222"} name={color?.name || "Cor Auxiliar"} className="snap-start" />
            ))}
            <PaletteChip 
              hex={paletteMetal === "Dourado" ? "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)" : "linear-gradient(135deg, #E0E0E0 0%, #9E9E9E 100%)"} 
              name={paletteMetal} 
              className="snap-start" 
            />
          </div>
        ) : (
          <Text className="text-white/60 text-sm">Paleta cromática pendente de mapeamento profundo.</Text>
        )}
      </div>

      {/* Os 3 Looks */}
      <div className="mt-16">
        <div className="px-6 mb-6">
          <Heading as="h3">Matches do Catálogo</Heading>
          <Text className="text-white/40 text-xs">Conectamos seu desejo real às peças disponíveis.</Text>
        </div>

        {looksArray.length > 0 ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory pl-6 pb-8 hide-scrollbar">
            {looksArray.map((look, i) => (
              <LookCardSwipeable key={look?.id || `look-${i}`} look={look as any} />
            ))}
          </div>
        ) : (
          <div className="px-6 pb-8">
            <Text className="text-white/50 text-sm border border-white/10 p-4 rounded-xl">Infelizmente, acervo de terceiros no momento encontra-se indisponível com esse cruzamento.</Text>
          </div>
        )}
      </div>

      {/* Visagismo e Corte */}
      <div className="mt-12 px-6">
        <Heading as="h3" className="mb-6">Engenharia do Shape</Heading>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <BentoGridBlock title="Arquitetura" description={archShoulders} icon={<UserCircle2 className="w-5 h-5"/>} />
          </div>
          <BentoGridBlock title="Visagismo Frontal" description={archFace} />
          <BentoGridBlock title="Escala de Detalhe" description={archScale} icon={<Watch className="w-5 h-5"/>} />
          <div className="col-span-2">
            <BentoGridBlock title="Alvo Geométrico" description={`${archFocal} ${archAdvice}`} />
          </div>
        </div>
      </div>

      {/* O que Evitar */}
      {avoidanceList.length > 0 && (
        <div className="mt-16 px-6">
          <Heading as="h3" className="text-red-500/90 mb-2">Linhas Mapeadas de Risco</Heading>
          <Text className="text-white/50 text-xs mb-4">Cortando modelagens e escolhas que sabotam o design planejado.</Text>
          <AccordionList items={avoidanceList as string[]} />
        </div>
      )}

      {/* CTA Final */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-50 pointer-events-none">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-[32px] text-center shadow-2xl pointer-events-auto">
          <Heading as="h4" className="text-sm mb-4 font-serif text-white uppercase tracking-wider">A Bússola Está Ativa</Heading>
          
          <div className="space-y-3">
            <Link href="#" className="block w-full">
              <VenusButton variant="solid" className="w-full text-black bg-white hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                Acessar Vitrine Direta
              </VenusButton>
            </Link>
            
            {!isSaved && (
              <Link href={`/auth/save-profile?id=${id}`} className="block w-full">
                <VenusButton variant="ghost" className="w-full text-xs text-[#D4AF37] underline-offset-4">
                  Salvar Assinatura para Sempre →
                </VenusButton>
              </Link>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
