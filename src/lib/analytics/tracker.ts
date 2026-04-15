/**
 * Behavior Tracking engine for Venus Engine.
 * Stores clicks, views, shares, and purchases to power dynamic content ranking.
 */

interface TrackEvent {
  id: string;
  type: 'click' | 'view' | 'add' | 'share' | 'complete_look';
  category: 'product' | 'look';
  timestamp: number;
}

export interface BehaviorMetricMap {
  [id: string]: Record<string, number>;
}

export interface BehaviorStatsSummary {
  looks: BehaviorMetricMap;
  products: BehaviorMetricMap;
}

export const trackBehavior = (id: string, type: TrackEvent['type'], category: TrackEvent['category']) => {
  if (typeof window === 'undefined') return;

  const event: TrackEvent = { id, type, category, timestamp: Date.now() };
  console.log(`[ALGO] Event Tracked: ${type} on ${category}(${id})`);

  // Simulate storing and returning real-time rank impact
  const stored = JSON.parse(localStorage.getItem('venus_stats') || '{}');
  const countKey = `${category}_${id}_${type}`;
  stored[countKey] = (stored[countKey] || 0) + 1;
  localStorage.setItem('venus_stats', JSON.stringify(stored));
  window.dispatchEvent(new Event("venus-stats-updated"));
};

export const getEngagedIds = (category: TrackEvent['category']): string[] => {
  if (typeof window === 'undefined') return [];
  const stored = JSON.parse(localStorage.getItem('venus_stats') || '{}');
  
  const sorted = Object.entries(stored)
    .filter(([key]) => key.startsWith(`${category}_`) && key.endsWith('_click'))
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([key]) => key.split('_')[1]);

  return sorted;
};

export const getStatsSummary = () => {
  if (typeof window === 'undefined') return { looks: {}, products: {} } satisfies BehaviorStatsSummary;
  const stored = JSON.parse(localStorage.getItem('venus_stats') || '{}');
  
  const summary: BehaviorStatsSummary = { looks: {}, products: {} };

  Object.entries(stored).forEach(([key, value]) => {
    const [category, id, type] = key.split('_');
    const catKey = category === 'look' ? 'looks' : 'products';
    
    if (!summary[catKey][id]) summary[catKey][id] = {};
    summary[catKey][id][type] = typeof value === 'number' ? value : Number(value) || 0;
  });

  return summary;
};
