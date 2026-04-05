/**
 * Venus AI WhatsApp Copywriter.
 * Generates persuasive, brand-aligned messages for re-engagement.
 */

import { CampaignObjective, AudienceSegment } from "@/types/whatsapp";

interface GeneratedCopy {
  headline: string;
  body: string;
  cta: string;
}

export const generateWACopy = (
  objective: CampaignObjective, 
  segment: AudienceSegment, 
  tone: 'premium' | 'elegant' | 'persuasive' | 'concise'
): GeneratedCopy => {
  
  // Heuristic-based generation (AI Logic Simulation)
  const segments: Record<string, string> = {
    inativos: "Sentimos sua falta na Maison Elite.",
    alta_intencao: "Vimos o seu interesse naquela curadoria.",
    try_on_users: "Sua versão AI do look anterior foi um sucesso.",
    bundle_buyers: "Como está sua última aquisição de look completo?",
    high_ticket: "Temos uma nova curadoria de elite disponível."
  };

  const objectives: Record<string, string> = {
    novidades: "Temos novos horizontes de estilo para você.",
    recompra: "Baseado no seu perfil, uma nova peça foi selecionada.",
    look_da_semana: "Este é o 'Look da Semana' baseado na sua autoridade.",
    recuperar_inativo: "Uma proposta exclusiva para seu retorno.",
    cross_sell: "O acessório perfeito para o seu último look acaba de chegar.",
    pos_compra: "Sua satisfação é nossa prioridade absoluta."
  };

  const segmentMsg = segments[segment] || "Valorizamos sua presença na Maison Elite.";
  const objectiveMsg = objectives[objective] || "Temos algo especial em nossa curadoria.";

  const templates: Record<typeof tone, GeneratedCopy> = {
    premium: {
      headline: "Exclusividade Venus Engine",
      body: `Prezado(a), ${segmentMsg} ${objectiveMsg} Unimos arquitetura e tecido para sua presença.`,
      cta: "Ver Detalhes na Boutique"
    },
    elegant: {
      headline: "Um toque de sofisticação",
      body: `Olá, ${segmentMsg} ${objectiveMsg} Uma nova expressão de elegância aguarda por você.`,
      cta: "Explorar Coleção"
    },
    persuasive: {
      headline: "Oportunidade Estratégica",
      body: `Temos um dado de estilo: ${segmentMsg} ${objectiveMsg} Não deixe essa versão de si mesmo escapar.`,
      cta: "Garantir Peça Única"
    },
    concise: {
      headline: "Novo no Venus",
      body: `${objectiveMsg} Alinhamento total com seu perfil.`,
      cta: "Ver Agora"
    }
  };

  return templates[tone];
};
