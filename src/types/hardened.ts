/**
 * Venus Hardened Production Schema.
 * Defines the core structures for Multi-tenant isolation, RBAC, 
 * Audit logging and Usage tracking.
 */

export type Role = 
  | 'agency_owner' | 'agency_admin' | 'agency_ops' | 'agency_support'
  | 'merchant_owner' | 'merchant_manager' | 'merchant_editor' | 'merchant_viewer';

export type ResourceType = 'product' | 'catalog' | 'look' | 'trial' | 'tenant' | 'plan' | 'ai_config';

export type ActionType = 'create' | 'update' | 'delete' | 'view' | 'enrich' | 'toggle' | 'simulate';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: Role;
  orgId: string;
  resource: ResourceType;
  action: ActionType;
  success: boolean;
  payload?: any;
  metadata?: {
    ip?: string;
    userAgent?: string;
    targetId?: string;
  };
}

export interface TenantUsage {
  orgId: string;
  billingCycle: string; // YYYY-MM
  counts: {
    analyses: number;
    tryOns: number;
    aiEnrichedProducts: number;
    shares: number;
  };
  costs: {
    aiTextCost: number;
    aiImageCost: number;
    storageCost: number;
  };
  healthScore: number; // 0-100
}

export type DataOrigin = 'REAL' | 'ESTIMATED' | 'HEURISTIC' | 'MOCK';

export interface MetricCard {
  id: string;
  label: string;
  value: any;
  trend?: string;
  origin: DataOrigin;
  sourceDescription: string;
}

export interface FeatureFlags {
  tryOnEnabled: boolean;
  sharingEnabled: boolean;
  aiEnrichmentEnabled: boolean;
  bundleDiscoveryEnabled: boolean;
  usageLimits: {
    monthlyTryOns: number;
    maxProducts: number;
  };
}
