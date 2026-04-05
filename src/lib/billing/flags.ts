/**
 * Venus Feature Flags & Usage Limits System.
 * Individual tenant controls for features and resource limits.
 */

import { FeatureFlags } from "@/types/hardened";

const DEFAULT_FLAGS: FeatureFlags = {
  tryOnEnabled: true,
  sharingEnabled: true,
  aiEnrichmentEnabled: true,
  bundleDiscoveryEnabled: true,
  usageLimits: {
    monthlyTryOns: 100,
    maxProducts: 50
  }
};

/**
 * Step 6: Feature Control Per Tenant.
 */
export const getFeatureFlags = (orgId: string): FeatureFlags => {
  try {
    const saved = localStorage.getItem(`venus_flags_${orgId}`);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.error(`[FLAGS_FAIL] Could not load flags for ${orgId}`);
  }
  return DEFAULT_FLAGS;
};

export const updateFeatureFlags = (orgId: string, flags: Partial<FeatureFlags>) => {
  const current = getFeatureFlags(orgId);
  const updated = { ...current, ...flags };
  localStorage.setItem(`venus_flags_${orgId}`, JSON.stringify(updated));
  return updated;
};

/**
 * Check if a resource usage is within limits.
 */
export const isWithinLimits = (orgId: string, resource: 'tryOns' | 'products'): boolean => {
  const flags = getFeatureFlags(orgId);
  const usageStr = localStorage.getItem(`venus_usage_${orgId}`) || '{}';
  const usage = JSON.parse(usageStr);

  const currentCount = usage[resource === 'tryOns' ? 'tryOns' : 'aiEnrichedProducts'] || 0;
  const limit = resource === 'tryOns' ? flags.usageLimits.monthlyTryOns : flags.usageLimits.maxProducts;

  return currentCount < limit;
};
