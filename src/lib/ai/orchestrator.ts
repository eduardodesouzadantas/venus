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
    intentScore > 75 ? 'show_bundle' :
    intentScore > 40 ? 'offer_tryon' : 'discovery';

  // 3. Recommender AI (Dynamic Ranking)
  const rankedLooks = [...looks].sort((a, b) => {
    const aScore =
      (stats.views[a.id] || 0) * 2 +
      (stats.clicks[a.id] || 0) * 5 +
      (stats.bundles[a.id] || 0) * 20 +
      (stats.shares[a.id] || 0) * 10;
    const bScore =
      (stats.views[b.id] || 0) * 2 +
      (stats.clicks[b.id] || 0) * 5 +
      (stats.bundles[b.id] || 0) * 20 +
      (stats.shares[b.id] || 0) * 10;
    const scoreDiff = bScore - aScore;
    if (scoreDiff !== 0) return scoreDiff;
    const nameDiff = a.name.localeCompare(b.name, "pt-BR");
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id, "pt-BR");
  });

  return {
    rankedLooks,
    aiInsight: {
      intentScore,
      dominantStyle: 'minimalist',
      priceSensitivity: 'medium',
      nextBestAction: nextAction,
      intensity,
      strategy: getConversionStrategy(intensity)
    }
  };
};

function getConversionStrategy(level: 'LOW' | 'MEDIUM' | 'HIGH') {
  const strategies: Record<string, {
    title: string;
    cta: string;
    mode: 'discovery' | 'persuasion' | 'aggressive';
    urgency?: string | null;
    trigger?: string | null;
  }> = {
    LOW: {
      title: "Leitura Inicial",
      cta: "Ver combinações reais",
      mode: 'discovery',
      trigger: "Ainda faltam sinais fortes; mostre opções claras e seguras."
    },
    MEDIUM: {
      title: "Presença Guiada",
      cta: "Ver como isso funciona em você",
      mode: 'persuasion',
      urgency: "Há sinais de interesse, mas ainda falta confirmação prática.",
      trigger: "Mostre o look mais coerente e explique o motivo sem exagero."
    },
    HIGH: {
      title: "Decisão Pronta",
      cta: "Ver o conjunto mais forte",
      mode: 'aggressive',
      urgency: "O sinal é forte; vale reduzir opções e avançar com clareza.",
      trigger: "Entregue o conjunto mais convincente sem soar promocional."
    }
  };
  return strategies[level];
}

/**
 * Step 4: Merchant Optimization AI
 */
type MerchantLookStats = {
  view?: number;
  complete_look?: boolean;
};

type MerchantStats = {
  looks?: Record<string, MerchantLookStats>;
};

export const getMerchantOptimization = (allStats: MerchantStats) => {
  const lowPerforming: string[] = [];
  
  // Logic to identify gaps (e.g. high views but zero bundles)
  Object.entries(allStats.looks || {}).forEach(([id, data]) => {
    if ((data.view || 0) > 10 && !data.complete_look) {
      lowPerforming.push(id);
    }
  });

  return lowPerforming.map(id => ({
    id,
    issue: "Alta visibilidade, baixa conversão",
    suggestion: "O look recebe atenção, mas ainda não vira decisão. Revise a capa, a explicação e a coerência das peças.",
    impact: "Oportunidade de conversão não capturada"
  }));
};
