"use client";

import { useState, useCallback, useRef } from "react";
import { ensureTryOnProductId } from "@/lib/tryon/product-id";

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

/**
 * Resolve a person image to a public HTTPS URL.
 * If the image is already an https:// URL, return it directly.
 * If it's a data: URI or blob:, upload to Supabase Storage and return the public URL.
 */
async function resolvePublicImageUrl(imageInput: string, orgId: string): Promise<string> {
  // Already a public URL — nothing to do
  if (imageInput.startsWith("https://")) {
    return imageInput;
  }

  // Convert data: URI to a Blob
  let blob: Blob;
  if (imageInput.startsWith("data:")) {
    const res = await fetch(imageInput);
    blob = await res.blob();
  } else if (imageInput.startsWith("blob:")) {
    const res = await fetch(imageInput);
    blob = await res.blob();
  } else {
    // Unknown format — try sending as-is and let the API decide
    console.warn("[useTryOn] Unknown image format, attempting to use as-is");
    return imageInput;
  }

  // Upload to the public tryon-uploads endpoint
  const formData = new FormData();
  formData.append("file", blob, `tryon_${Date.now()}.jpg`);
  formData.append("org_id", orgId);

  const uploadRes = await fetch("/api/tryon/upload", {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error("Falha ao fazer upload da sua foto. Tente novamente.");
  }

  const { publicUrl } = (await uploadRes.json()) as { publicUrl: string };
  console.log("[useTryOn] Uploaded person image:", publicUrl);
  return publicUrl;
}

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
        const resolvedProductId = ensureTryOnProductId(product_id);
        if (!resolvedProductId) {
          console.error("[useTryOn] Invalid product_id before try-on", {
            product_id,
            saved_result_id,
            org_id,
          });
          setError("Produto inválido para try-on.");
          setStatus("failed");
          return;
        }

        // Step 1: Resolve the person image to a public URL
        console.log("[useTryOn] Resolving person image...", {
          isDataUri: model_image.startsWith("data:"),
          isBlob: model_image.startsWith("blob:"),
          isHttps: model_image.startsWith("https://"),
          length: model_image.length,
        });

        const resolvedPersonUrl = await resolvePublicImageUrl(model_image, org_id);

        // Step 2: Resolve garment image URL from the product
        const productRes = await fetch(`/api/tryon/resolve-product?product_id=${encodeURIComponent(resolvedProductId)}&org_id=${encodeURIComponent(org_id)}`);

        let garmentImageUrl = "";
        if (productRes.ok) {
          const productData = await productRes.json();
          garmentImageUrl = productData.image_url || "";
        }

        if (!garmentImageUrl) {
          setError("Produto sem imagem disponível para try-on.");
          setStatus("failed");
          return;
        }

        console.log("[useTryOn] Calling /api/tryon/auto with:", {
          person: resolvedPersonUrl.substring(0, 80),
          garment: garmentImageUrl.substring(0, 80),
        });

        // Step 3: Call the auto try-on endpoint (no auth required)
        const res = await fetch("/api/tryon/auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personImageUrl: resolvedPersonUrl,
            garmentImageUrl,
            orgId: org_id,
            category: "tops",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Erro ao iniciar geração. Tente novamente.");
          setStatus("failed");
          return;
        }

        const autoResult = await res.json();
        console.log("[useTryOn] Auto result:", autoResult);

        // If the image was generated synchronously (within timeout)
        if (autoResult.status === "completed" && autoResult.generatedImageUrl) {
          clearTimers();
          setProgress(100);
          setImageUrl(autoResult.generatedImageUrl);
          setStatus("completed");
          return;
        }

        // If still processing, start polling
        const requestId = autoResult.requestId;
        if (!requestId) {
          setError("Falha na fila de geração. Tente novamente.");
          setStatus("failed");
          return;
        }

        setStatus("processing");

        // Simulated progress while fal.ai processes (8–15s typical)
        progressRef.current = setInterval(() => {
          progressVal = Math.min(progressVal + Math.random() * 6, 88);
          setProgress(Math.round(progressVal));
        }, 1200);

        // Poll status every 3 seconds via /api/tryon/auto GET
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/tryon/auto?request_id=${requestId}&org_id=${org_id}`);
            if (!statusRes.ok) return;

            const data = await statusRes.json();

            if (data.status === "completed" && data.generatedImageUrl) {
              clearTimers();
              setProgress(100);
              setImageUrl(data.generatedImageUrl);
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
      } catch (err) {
        clearTimers();
        console.error("[useTryOn] Error:", err);
        setError(err instanceof Error ? err.message : "Erro de conexão. Verifique sua internet e tente novamente.");
        setStatus("failed");
      }
    },
    [clearTimers]
  );

  return { status, imageUrl, progress, error, startTryOn, reset };
}
