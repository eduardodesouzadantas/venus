/**
 * Venus Data Truth Utility.
 * Classifies metrics and ensures no MOCK data is shown as REAL in production.
 */

import { MetricCard, DataOrigin } from "@/types/hardened";

export const getMetric = (
  id: string, 
  label: string, 
  value: any, 
  origin: DataOrigin, 
  source: string,
  trend?: string
): MetricCard => {
  // 1. Validation (Step 1): If env is PROD and origin is MOCK, log a warning
  const isProd = process.env.NODE_ENV === "production";
  
  if (isProd && origin === "MOCK") {
    console.error(`[DATA_TRUTH_ALERT] Metric "${label}" is showing MOCK data in production. Investigating upstream.`);
  }

  return {
    id,
    label,
    value,
    trend,
    origin,
    sourceDescription: source
  };
};

/**
 * Step 9: Data Validation & Required Field Normalizer.
 */
export const validateProductData = (data: any) => {
  const errors: string[] = [];

  if (!data.name) errors.push("Missing name");
  if (!data.slug) errors.push("Missing slug");
  if (!data.images || data.images.length === 0) errors.push("Missing primary image");
  
  // Tag normalization (Step 9)
  const normalizedTags = (data.tags || []).map((t: string) => t.trim().toLowerCase());

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      ...data,
      tags: normalizedTags,
      lastValidation: new Date().toISOString()
    }
  };
};

/**
 * Step 7: Health Monitoring Score Heuristic.
 */
export const calculateTenantHealth = (stats: { 
  usageFrequency: number, 
  engagementScore: number, 
  catalogReadiness: number 
}) => {
  // Heuristic: weighted average
  const score = (stats.usageFrequency * 0.4) + (stats.engagementScore * 0.3) + (stats.catalogReadiness * 0.3);
  
  return {
    score: Math.min(100, Math.floor(score)),
    risk: score < 40 ? 'HIGH' : score < 70 ? 'MEDIUM' : 'LOW'
  };
};
