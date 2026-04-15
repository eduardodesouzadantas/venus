"use client";

import { useCallback } from "react";

export function useLookCompositionTracking(lookId: string) {
  const trackInteraction = useCallback(
    async (type: "view" | "tryon_click" | "tryon_generate" | "whatsapp_click" | "purchase_intent", metadata?: Record<string, unknown>) => {
      try {
        await fetch(`/api/look-composition/${lookId}/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            metadata,
            sourcePage: window.location.pathname,
          }),
        });
      } catch (err) {
        // Silently fail - tracking shouldn't break the flow
        console.error("[useLookCompositionTracking] Error:", err);
      }
    },
    [lookId]
  );

  const trackConversion = useCallback(
    async (data: {
      purchasedProductIds: string[];
      totalValue?: number;
      source?: string;
    }) => {
      try {
        await fetch(`/api/look-composition/${lookId}/track`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch (err) {
        console.error("[useLookCompositionTracking] Error:", err);
      }
    },
    [lookId]
  );

  return {
    trackInteraction,
    trackConversion,
  };
}
