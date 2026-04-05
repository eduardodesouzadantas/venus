/**
 * Venus AI Orchestration Layer.
 * Coordinates behavior analysis, intent prediction and personalization.
 */

import { LookData } from "@/types/result";

export interface UserStats {
  views: Record<string, number>;
  clicks: Record<string, number>;
  shares: Record<string, number>;
  bundles: Record<string, number>;
  timeSpent?: number;
  tryOnUsed?: boolean;
}

export interface AIRecommendation {
  intentScore: number; // 0-100
  dominantStyle: 'authority' | 'elegance' | 'casual' | 'minimalist';
  priceSensitivity: 'low' | 'medium' | 'high';
  nextBestAction: 'show_bundle' | 'offer_tryon' | 'show_details' | 'aggressive_cta' | 'discovery';
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  strategy: {
    title: string;
    cta: string;
    mode: 'discovery' | 'persuasion' | 'aggressive';
    urgency?: string | null;
    trigger?: string | null;
  };
}

/**
 * Step 1 & 2: Real-time Ranking & Purchase Prediction
 */
export const orchestrateExperience = (stats: UserStats, looks: LookData[]): {
  rankedLooks: LookData[];
  aiInsight: AIRecommendation;
} => {
  // 1. Calculate Intent Score (Prediction AI)
  let intentScore = 40; // Base score
  const totalClicks = Object.values(stats.clicks).reduce((a, b) => a + b, 0);
  const totalBundles = Object.values(stats.bundles).reduce((a, b) => a + b, 0);
  const totalShares = Object.values(stats.shares).reduce((a, b) => a + b, 0);

  intentScore += totalClicks * 8;
  intentScore += totalBundles * 35;
  intentScore += totalShares * 15;
  if (stats.tryOnUsed) intentScore += 40;
  if (stats.timeSpent && stats.timeSpent > 120) intentScore += 15;
  
  intentScore = Math.min(intentScore, 100);

  // 2. Personalization AI (Style & Price Profile)
  const intensity: AIRecommendation['intensity'] = 
    intentScore > 75 ? 'HIGH' : 
    intentScore > 40 ? 'MEDIUM' : 'LOW';

  const nextAction: AIRecommendation['nextBestAction'] = 
    intentScore > 75 ? 'aggressive_cta' : 
    intentScore > 40 ? 'offer_tryon' : 'discovery';

  // 3. Recommender AI (Dynamic Ranking)
  const rankedLooks = [...looks].sort((a, b) => {
    const aScore = (stats.clicks[a.id] || 0) * 5 + (stats.bundles[a.id] || 0) * 20 + (stats.shares[a.id] || 0) * 10;
    const bScore = (stats.clicks[b.id] || 0) * 5 + (stats.bundles[b.id] || 0) * 20 + (stats.shares[b.id] || 0) * 10;
    return bScore - aScore;
  });

  return {
    rankedLooks,
    aiInsight: {
      intentScore,
      dominantStyle: 'minimalist',
      priceSensitivity: 'medium',
      nextBestAction: nextAction,
      intensity,
      strategy: getConversionStrategy(intensity, stats)
    }
  };
};

function getConversionStrategy(level: 'LOW' | 'MEDIUM' | 'HIGH', stats: UserStats) {
  const strategies: Record<string, any> = {
    LOW: {
      title: "Exploração Estética",
      cta: "Explorar mais possibilidades",
      mode: 'discovery',
      trigger: "Sua imagem é seu maior ativo. Comece a investir nela hoje."
    },
    MEDIUM: {
      title: "Identidade & Presença",
      cta: "Ver como isso funciona em você",
      mode: 'persuasion',
      urgency: "Esse estilo está em alta esta semana",
      trigger: "Isso resolve exatamente o desalinhamento da sua imagem percebida."
    },
    HIGH: {
      title: "Transformação Imediata",
      cta: "APLICAR ESSA TRANSFORMAÇÃO AGORA",
      mode: 'aggressive',
      urgency: "Últimas combinações disponíveis para seu perfil de elite.",
      trigger: "Esse é o ponto que separa presença de anonimato. Faça sua escolha."
    }
  };
  return strategies[level];
}

/**
 * Step 4: Merchant Optimization AI
 */
export const getMerchantOptimization = (allStats: any) => {
  const lowPerforming: string[] = [];
  
  // Logic to identify gaps (e.g. high views but zero bundles)
  Object.entries(allStats.looks || {}).forEach(([id, data]: [string, any]) => {
    if (data.view > 10 && !data.complete_look) {
      lowPerforming.push(id);
    }
  });

  return lowPerforming.map(id => ({
    id,
    issue: "High Visibility, Low Conversion",
    suggestion: "O 'Try-On' para este look está sendo ignorado. Tente uma imagem de capa com mais contraste ou mude a descrição premium.",
    impact: "Potential +15% revenue lift"
  }));
};
