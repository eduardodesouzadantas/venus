"use client";

import { useState, useCallback } from "react";
import type { SavedLookComposition } from "@/lib/look-composition/db";

export type LookTryOnStatus = "idle" | "processing" | "completed" | "failed";

interface UseLookCompositionTryOnResult {
  status: LookTryOnStatus;
  imageUrl: string | null;
  error: string | null;
  generateTryOn: (params: {
    lookId: string;
    personImageUrl: string;
    orgId: string;
    leadId?: string;
    resultId?: string;
  }) => Promise<void>;
  reset: () => void;
}

export function useLookCompositionTryOn(): UseLookCompositionTryOnResult {
  const [status, setStatus] = useState<LookTryOnStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateTryOn = useCallback(async ({
    lookId,
    personImageUrl,
    orgId,
    leadId,
    resultId,
  }: {
    lookId: string;
    personImageUrl: string;
    orgId: string;
    leadId?: string;
    resultId?: string;
  }) => {
    setStatus("processing");
    setError(null);
    setImageUrl(null);

    try {
      const response = await fetch(`/api/look-composition/${lookId}/tryon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personImageUrl,
          orgId,
          leadId,
          resultId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate try-on");
      }

      const data = await response.json();
      setImageUrl(data.imageUrl);
      setStatus("completed");
    } catch (err) {
      console.error("[useLookCompositionTryOn] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("failed");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setImageUrl(null);
    setError(null);
  }, []);

  return {
    status,
    imageUrl,
    error,
    generateTryOn,
    reset,
  };
}
