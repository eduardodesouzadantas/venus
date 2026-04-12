"use client";

import { useState, useCallback, useRef } from "react";

export type TryOnStatus = "idle" | "queued" | "processing" | "completed" | "failed";

interface UseTryOnResult {
  status: TryOnStatus;
  imageUrl: string | null;
  progress: number;
  error: string | null;
  startTryOn: (params: { model_image: string; product_id: string; org_id: string; saved_result_id: string }) => Promise<void>;
  reset: () => void;
}

export const TRYON_LOADING_MESSAGES = [
  "Analisando seu perfil...",
  "Ajustando caimento e proporção...",
  "Finalizando seu look...",
];

export function useTryOn(): UseTryOnResult {
  const [status, setStatus] = useState<TryOnStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setStatus("idle");
    setImageUrl(null);
    setProgress(0);
    setError(null);
  }, [clearTimers]);

  const startTryOn = useCallback(
    async ({
      model_image,
      product_id,
      org_id,
      saved_result_id,
    }: {
      model_image: string;
      product_id: string;
      org_id: string;
      saved_result_id: string;
    }) => {
      clearTimers();
      setStatus("queued");
      setProgress(5);
      setError(null);
      setImageUrl(null);

      let progressVal = 5;

      try {
        const res = await fetch("/api/tryon/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_image, product_id, org_id, saved_result_id }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "monthly_limit_reached") {
            setError(`Limite de ${data.limit} try-ons mensais atingido. Fale com o suporte para fazer upgrade.`);
          } else {
            setError(data.error || "Erro ao iniciar geração. Tente novamente.");
          }
          setStatus("failed");
          return;
        }

        const { request_id } = (await res.json()) as { request_id: string };
        setStatus("processing");

        // Progresso simulado enquanto fal.ai processa (8–15s típicos)
        progressRef.current = setInterval(() => {
          progressVal = Math.min(progressVal + Math.random() * 6, 88);
          setProgress(Math.round(progressVal));
        }, 1200);

        // Polling de status a cada 3 segundos
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/tryon/status?id=${request_id}&org_id=${org_id}`);
            if (!statusRes.ok) return;

            const data = (await statusRes.json()) as {
              status: "completed" | "failed" | "processing" | "queued";
              image_url?: string;
            };

            if (data.status === "completed") {
              clearTimers();
              setProgress(100);
              setImageUrl(data.image_url ?? null);
              setStatus("completed");
            } else if (data.status === "failed") {
              clearTimers();
              setError("A geração falhou. Tente com outra foto ou peça.");
              setStatus("failed");
            }
          } catch {
            // Silencia erro de polling temporário — vai tentar novamente
          }
        }, 3000);
      } catch {
        clearTimers();
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
        setStatus("failed");
      }
    },
    [clearTimers]
  );

  return { status, imageUrl, progress, error, startTryOn, reset };
}
