"use client";

import { useState, useCallback, useRef } from "react";
import { ensureTryOnProductId } from "@/lib/tryon/product-id";
import { TRYON_PREMIUM_REFINED_MESSAGE } from "@/lib/tryon/fallback-copy";

export type TryOnStatus = "idle" | "queued" | "processing" | "fallback" | "completed" | "failed";

interface UseTryOnResult {
  status: TryOnStatus;
  imageUrl: string | null;
  progress: number;
  error: string | null;
  lateSuccessNotice: string | null;
  startTryOn: (params: { model_image: string; product_id: string; org_id: string; saved_result_id: string }) => Promise<void>;
  reset: () => void;
}

export const TRYON_LOADING_MESSAGES = [
  "Analisando seu perfil...",
  "Ajustando caimento e proporcao...",
  "Finalizando seu look...",
];

const TRYON_POLL_INTERVAL_MS = 3_000;
const TRYON_MAX_WAIT_MS = 25_000;

type TryOnAutoResponse = {
  status?: string;
  generatedImageUrl?: string | null;
  requestId?: string | null;
  orgId?: string | null;
  error?: string | null;
};

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer) clearTimeout(timer);
}

/**
 * Resolve a person image to a public HTTPS URL.
 * If the image is already an https:// URL, return it directly.
 * If it's a data: URI or blob:, upload to Supabase Storage and return the public URL.
 */
async function resolvePublicImageUrl(imageInput: string, orgId: string): Promise<string> {
  if (imageInput.startsWith("https://")) {
    return imageInput;
  }

  let blob: Blob;
  if (imageInput.startsWith("data:")) {
    const res = await fetch(imageInput);
    blob = await res.blob();
  } else if (imageInput.startsWith("blob:")) {
    const res = await fetch(imageInput);
    blob = await res.blob();
  } else {
    return imageInput;
  }

  const formData = new FormData();
  formData.append("file", blob, `tryon_${Date.now()}.jpg`);
  formData.append("org_id", orgId);

  const uploadRes = await fetch("/api/tryon/upload", {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const body = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
    console.warn("[useTryOn] upload failed", {
      orgId,
      status: uploadRes.status,
      error: body?.error || null,
    });
    throw new Error(body?.error || "Falha ao fazer upload da sua foto. Tente novamente.");
  }

  const { publicUrl } = (await uploadRes.json()) as { publicUrl: string };
  console.info("[useTryOn] upload completed", { orgId, hasPublicUrl: Boolean(publicUrl) });
  return publicUrl;
}

export function useTryOn(): UseTryOnResult {
  const [status, setStatus] = useState<TryOnStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lateSuccessNotice, setLateSuccessNotice] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lateNoticeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const fallbackShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    clearTimer(timeoutRef.current);
    clearTimer(lateNoticeRef.current);
    pollingRef.current = null;
    progressRef.current = null;
    timeoutRef.current = null;
    lateNoticeRef.current = null;
  }, []);

  const showLateSuccessNotice = useCallback(() => {
    setLateSuccessNotice(TRYON_PREMIUM_REFINED_MESSAGE);
    clearTimer(lateNoticeRef.current);
    lateNoticeRef.current = setTimeout(() => {
      setLateSuccessNotice(null);
    }, 6000);
  }, []);

  const activateFallback = useCallback(
    (reason: string, context: { orgId: string; requestId?: string | null; status?: string | null }) => {
      console.warn("[useTryOn] premium fallback activated", {
        orgId: context.orgId,
        reason,
        requestId: context.requestId || null,
        status: context.status || null,
      });

      fallbackShownRef.current = true;
      setStatus("fallback");
      setError(null);
      setProgress((current) => Math.max(current, 72));
      clearTimer(timeoutRef.current);
      timeoutRef.current = null;
    },
    []
  );

  const reset = useCallback(() => {
    clearTimers();
    activeRequestIdRef.current = null;
    fallbackShownRef.current = false;
    setStatus("idle");
    setImageUrl(null);
    setProgress(0);
    setError(null);
    setLateSuccessNotice(null);
  }, [clearTimers]);

  const startTryOn = useCallback(
    async ({
      model_image,
      product_id,
      org_id,
    }: {
      model_image: string;
      product_id: string;
      org_id: string;
      saved_result_id: string;
    }) => {
      clearTimers();
      activeRequestIdRef.current = null;
      fallbackShownRef.current = false;
      setStatus("queued");
      setProgress(5);
      setError(null);
      setLateSuccessNotice(null);
      setImageUrl(null);

      let progressVal = 5;

      try {
        const resolvedProductId = ensureTryOnProductId(product_id);
        if (!resolvedProductId) {
          activateFallback("invalid_product_id", { orgId: org_id });
          return;
        }

        const resolvedPersonUrl = await resolvePublicImageUrl(model_image, org_id);

        const productRes = await fetch(
          `/api/tryon/resolve-product?product_id=${encodeURIComponent(resolvedProductId)}&org_id=${encodeURIComponent(org_id)}`
        );

        let garmentImageUrl = "";
        if (productRes.ok) {
          const productData = await productRes.json();
          garmentImageUrl = productData.image_url || "";
          console.info("[useTryOn] product resolved", {
            orgId: org_id,
            productId: resolvedProductId,
            hasImageUrl: Boolean(garmentImageUrl),
          });
        } else {
          const body = await productRes.json().catch(() => null);
          console.warn("[useTryOn] product resolve failed", {
            orgId: org_id,
            productId: resolvedProductId,
            status: productRes.status,
            error: body?.error || null,
          });
        }

        if (!garmentImageUrl) {
          activateFallback("product_without_image", {
            orgId: org_id,
            requestId: null,
            status: "missing_garment_image",
          });
          return;
        }

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
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          console.warn("[useTryOn] auto try-on start failed", {
            orgId: org_id,
            status: res.status,
            error: data.error || null,
          });
          activateFallback(data.error || `start_failed_${res.status}`, {
            orgId: org_id,
            requestId: null,
            status: String(res.status),
          });
          return;
        }

        const autoResult = (await res.json()) as TryOnAutoResponse;
        console.info("[useTryOn] auto try-on response", {
          orgId: org_id,
          requestId: autoResult.requestId || null,
          status: autoResult.status || null,
          hasGeneratedImage: Boolean(autoResult.generatedImageUrl),
        });

        if (autoResult.status === "completed" && autoResult.generatedImageUrl) {
          clearTimers();
          setProgress(100);
          setImageUrl(autoResult.generatedImageUrl);
          setStatus("completed");
          return;
        }

        const requestId = autoResult.requestId;
        if (!requestId) {
          activateFallback("missing_request_id", {
            orgId: org_id,
            requestId: null,
            status: autoResult.status || null,
          });
          return;
        }

        activeRequestIdRef.current = requestId;
        setStatus("processing");

        progressRef.current = setInterval(() => {
          progressVal = Math.min(progressVal + Math.random() * 6, 88);
          setProgress(Math.round(progressVal));
        }, 1200);

        timeoutRef.current = setTimeout(() => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          activateFallback("poll_timeout", {
            orgId: org_id,
            requestId,
            status: "processing",
          });
        }, TRYON_MAX_WAIT_MS);

        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/tryon/auto?request_id=${requestId}&org_id=${org_id}`);
            if (!statusRes.ok) {
              const body = await statusRes.json().catch(() => null);
              console.warn("[useTryOn] poll status error", {
                orgId: org_id,
                requestId,
                status: statusRes.status,
                error: body?.error || null,
              });

              if (statusRes.status >= 500) {
                activateFallback(`poll_status_${statusRes.status}`, {
                  orgId: org_id,
                  requestId,
                  status: String(statusRes.status),
                });
              }
              return;
            }

            const data = (await statusRes.json()) as {
              status?: string;
              generatedImageUrl?: string;
            };

            console.info("[useTryOn] poll status", {
              orgId: org_id,
              requestId,
              status: data.status || null,
              hasGeneratedImage: Boolean(data.generatedImageUrl),
            });

            if (data.status === "completed" && data.generatedImageUrl) {
              clearTimers();
              setProgress(100);
              setImageUrl(data.generatedImageUrl);
              setStatus("completed");
              if (fallbackShownRef.current) {
                showLateSuccessNotice();
                console.info("[useTryOn] late success delivered", {
                  orgId: org_id,
                  requestId,
                  message: TRYON_PREMIUM_REFINED_MESSAGE,
                });
              }
            } else if (data.status === "failed") {
              activateFallback("poll_failed", {
                orgId: org_id,
                requestId,
                status: "failed",
              });
            }
          } catch (pollError) {
            console.warn("[useTryOn] polling error", {
              orgId: org_id,
              requestId,
              error: pollError instanceof Error ? pollError.message : String(pollError),
            });
            activateFallback("poll_exception", {
              orgId: org_id,
              requestId,
              status: "poll_error",
            });
          }
        }, TRYON_POLL_INTERVAL_MS);
      } catch (err) {
        console.error("[useTryOn] error during try-on; activating premium fallback", err);
        activateFallback("unexpected_error", {
          orgId: org_id,
          requestId: null,
          status: null,
        });
      }
    },
    [activateFallback, clearTimers, showLateSuccessNotice]
  );

  return { status, imageUrl, progress, error, lateSuccessNotice, startTryOn, reset };
}
