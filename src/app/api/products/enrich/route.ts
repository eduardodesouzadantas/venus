import { NextResponse } from "next/server";
import {
  PRODUCT_IMAGE_MAX_BYTES,
  buildFallbackProductEnrichment,
  buildProductEnrichmentFromAiPayload,
  normalizeProductCategory,
  normalizeProductStyle,
} from "@/lib/catalog/product-enrichment";
import {
  checkInMemoryRateLimit,
  logSecurityEvent,
  recordSecurityAlert,
} from "@/lib/reliability/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type GeminiPayload = {
  image_base64?: string;
  mime_type?: string;
  file_name?: string;
  name?: string;
  category?: string;
  org_id?: string;
  orgId?: string;
};

const PRODUCT_ENRICH_RATE_LIMIT = {
  limit: 6,
  windowMs: 5 * 60 * 1000,
};
const MAX_IMAGE_BASE64_LENGTH = Math.ceil(PRODUCT_IMAGE_MAX_BYTES * 1.5) + 1024;

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stripDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) {
    return {
      mimeType: "",
      base64: value,
    };
  }

  return {
    mimeType: match[1] || "",
    base64: match[2] || "",
  };
}

function parseGeminiJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(payload);
}

function buildFallbackResponse(body: GeminiPayload, warning?: string) {
  const result = buildFallbackProductEnrichment({
    name: body.name,
    category: body.category,
    fileName: body.file_name,
  });

  return NextResponse.json({
    ...result,
    fallback_used: true,
    warning: warning || result.warning || "fallback_used",
    file_name: normalize(body.file_name),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GeminiPayload | null;
  const orgId = normalize(body?.org_id || body?.orgId);
  const imageBase64 = normalize(body?.image_base64);

  if (!imageBase64) {
    return NextResponse.json({ error: "image_base64_missing" }, { status: 400 });
  }

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    logSecurityEvent("warn", "ai_payload_too_large", {
      route: "products/enrich",
      orgId: orgId || null,
      imageLength: imageBase64.length,
      maxLength: MAX_IMAGE_BASE64_LENGTH,
    });

    return NextResponse.json({ error: "image_base64_too_large" }, { status: 413 });
  }

  const rateLimit = checkInMemoryRateLimit({
    scope: "product_enrich",
    request,
    limit: PRODUCT_ENRICH_RATE_LIMIT.limit,
    windowMs: PRODUCT_ENRICH_RATE_LIMIT.windowMs,
    keyParts: [orgId || "global"],
  });

  if (!rateLimit.allowed) {
    logSecurityEvent("warn", "rate_limit_exceeded", {
      route: "products/enrich",
      orgId: orgId || null,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
      windowMs: PRODUCT_ENRICH_RATE_LIMIT.windowMs,
    });

    if (orgId) {
      await recordSecurityAlert(createAdminClient(), {
        orgId,
        orgSlug: null,
        eventType: "security.rate_limited",
        summary: "Product enrichment rate limit exceeded",
        details: {
          route: "products/enrich",
          retry_after_seconds: rateLimit.retryAfterSeconds,
          limit: rateLimit.limit,
        },
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        error: "rate_limited",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds || 60),
        },
      }
    );
  }

  if (body?.mime_type) {
    const mimeType = normalize(body.mime_type).toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      logSecurityEvent("warn", "invalid_ai_image_type", {
        route: "products/enrich",
        orgId: orgId || null,
        mimeType,
      });
      return NextResponse.json({ error: "image_invalid_type" }, { status: 400 });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[PRODUCT_ENRICH] GEMINI_API_KEY missing, using fallback");
    return buildFallbackResponse(body || {}, "gemini_api_key_missing");
  }

  const { mimeType, base64 } = stripDataUrl(imageBase64);
  const finalMimeType = normalize(body?.mime_type) || mimeType || "image/jpeg";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  const prompt = [
    "Voce e especialista em moda e e-commerce. Analise esta peca e retorne JSON com:",
    "name (string),",
    "category (roupa|acessorio),",
    "primary_color (string),",
    "style (alfaiataria|casual|streetwear|festa|luxo),",
    "description (2 a 3 frases objetivas sobre a peca),",
    "persuasive_description (2 a 3 frases de venda persuasiva em portugues),",
    "emotional_copy (2 frases de desejo e narrativa emocional em portugues),",
    "tags (array de 5 a 8 palavras-chave).",
    "Responda APENAS com JSON valido, sem markdown.",
  ].join(" ");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: finalMimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("[PRODUCT_ENRICH] Gemini request failed", {
        status: response.status,
        detail: detail.slice(0, 160),
      });
      return buildFallbackResponse(body || {}, "gemini_request_failed");
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
    if (!rawText) {
      console.warn("[PRODUCT_ENRICH] Gemini empty response");
      return buildFallbackResponse(body || {}, "gemini_empty_response");
    }

    const parsed = parseGeminiJson(rawText) as Record<string, unknown>;
    const normalized = buildProductEnrichmentFromAiPayload({
      ...parsed,
      name: normalize(parsed.name) || normalize(body?.name),
      category: normalizeProductCategory(normalize(parsed.category) || normalize(body?.category)),
      primary_color: normalize(parsed.primary_color || parsed.dominant_color),
      style: normalizeProductStyle(normalize(parsed.style)),
    });

    if (!normalized) {
      console.warn("[PRODUCT_ENRICH] Gemini payload rejected, using fallback");
      return buildFallbackResponse(body || {}, "gemini_payload_invalid");
    }

    return NextResponse.json({
      ...normalized,
      fallback_used: false,
      warning: null,
      file_name: normalize(body?.file_name),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[PRODUCT_ENRICH] Gemini analysis failed", {
      reason: message.slice(0, 160),
    });
    return buildFallbackResponse(body || {}, message.toLowerCase().includes("aborted") ? "gemini_timeout" : "gemini_analysis_failed");
  } finally {
    clearTimeout(timeout);
  }
}
