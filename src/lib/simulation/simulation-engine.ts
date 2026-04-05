/**
 * Simulation Engine for Venus Engine Commerce Validation.
 * Mimics different user behaviors to test conversion funnels.
 */

import { trackBehavior } from "../analytics/tracker";

export type UserProfile = 
  | 'authority_seeker' 
  | 'elegance_seeker' 
  | 'casual_style' 
  | 'low_intent' 
  | 'price_sensitive' 
  | 'high_intent_pro';

interface SimulationResult {
  profile: UserProfile;
  steps: string[];
  converted: boolean;
  timeSpent: number;
  revenue: number;
}

const LOOK_IDS = ["1", "2", "alt-1", "alt-2"];
const PRODUCT_IDS = ["1", "2", "3", "4", "a1", "a2", "a3", "a4"];

export const runUserSimulation = async (profile: UserProfile): Promise<SimulationResult> => {
  const steps: string[] = [];
  let converted = false;
  let revenue = 0;
  let timeSpent = 0;

  // 1. Initial Page View
  steps.push("View Result Page");
  timeSpent += Math.random() * 5 + 2;

  // 2. Behavior adjustment by profile
  const prob = (p: number) => Math.random() < p;

  // Simulation Logic
  switch (profile) {
    case 'authority_seeker':
      if (prob(0.9)) {
        steps.push("View Look 1");
        trackBehavior("1", "view", "look");
        if (prob(0.7)) {
          steps.push("Click Try-On Look 1");
          trackBehavior("1", "view", "look"); // Try-on count
          if (prob(0.6)) {
            steps.push("Complete Look Purchase Intent (Look 1)");
            trackBehavior("1", "complete_look", "look");
            converted = true;
            revenue += 2800;
          }
        }
      }
      break;

    case 'price_sensitive':
      steps.push("Scan Palette");
      if (prob(0.6)) {
        const prodId = PRODUCT_IDS[Math.floor(Math.random() * 4)];
        steps.push(`View Product ${prodId}`);
        trackBehavior(prodId, "click", "product");
        if (prob(0.3)) {
          steps.push(`Add to Look ${prodId}`);
          trackBehavior(prodId, "add", "product");
          revenue += 800;
          converted = true;
        }
      }
      break;

    case 'high_intent_pro':
      steps.push("Full Scan");
      LOOK_IDS.forEach(id => {
        if (prob(0.8)) {
          trackBehavior(id, "view", "look");
          if (prob(0.5)) trackBehavior(id, "complete_look", "look");
        }
      });
      converted = prob(0.9);
      if (converted) revenue += 3500;
      break;

    case 'low_intent':
      steps.push("Quick Scroll");
      timeSpent += 5;
      break;
    
    default:
      steps.push("Browsing");
      break;
  }

  return { profile, steps, converted, timeSpent, revenue };
};

export const runBatchSimulation = async (count: number) => {
  const results: SimulationResult[] = [];
  const profiles: UserProfile[] = ['authority_seeker', 'elegance_seeker', 'casual_style', 'low_intent', 'price_sensitive', 'high_intent_pro'];

  for (let i = 0; i < count; i++) {
    const profile = profiles[Math.floor(Math.random() * profiles.length)];
    const res = await runUserSimulation(profile);
    results.push(res);
  }

  // Aggregate results
  const totalRevenue = results.reduce((acc, r) => acc + r.revenue, 0);
  const conversionRate = (results.filter(r => r.converted).length / count) * 100;
  
  return {
    sessions: count,
    totalRevenue,
    conversionRate,
    avgAOV: totalRevenue / results.filter(r => r.converted).length || 0,
    results
  };
};
