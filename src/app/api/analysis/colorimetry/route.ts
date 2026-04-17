import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type { ColorimetryAnalysisData } from "@/types/onboarding";
import {
  checkInMemoryRateLimit,
  logSecurityEvent,
  recordSecurityAlert,
} from "@/lib/reliability/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ColorimetryPayload = {
  imageBase64?: string;
  imageSource?: string;
  imageUrl?: string;
  orgId?: string;
};

const FALLBACK_COLORIMETRY: ColorimetryAnalysisData = {
  skinTone: "médio",
  undertone: "neutro",
  contrast: "médio",
  colorSeason: "Neutro Equilibrado",
  favoriteColors: ["Marinho suave", "Grafite", "Off white", "Verde oliva"],
  avoidColors: ["Laranja vivo", "Amarelo aberto", "Neon"],
  confidence: "medium",
  evidence:
    "Leitura preliminar baseada nesta foto. Uma luz frontal neutra melhora a precisão. Base segura em marinho, grafite e off-white; acentos controlados em verde oliva; usar com cautela laranja vivo, amarelo aberto e neon.",
  basePalette: ["Marinho suave", "Grafite", "Off white", "Verde oliva"],
  accentPalette: ["Verde oliva fechado", "Prata", "Vinho fechado"],
  avoidOrUseCarefully: ["Laranja vivo", "Amarelo aberto", "Neon"],
  faceShape: "oval",
  idealNeckline: "Decote em V suave",
  idealFit: "Caimento reto com estrutura leve",
  idealFabrics: ["Algodão estruturado", "Lã fria", "Viscose encorpada"],
  avoidFabrics: ["Poliéster brilhante", "Tecidos muito plastificados"],
  justification:
    "A leitura neutra prioriza equilíbrio, contraste controlado e cores que mantêm a imagem limpa sem exagero. Quando a análise não consegue ser concluída com segurança, a Venus retorna uma base segura e versátil para não travar o fluxo.",
};

const COLORIMETRY_RATE_LIMIT = {
  limit: 4,
  windowMs: 10 * 60 * 1000,
};
const MAX_IMAGE_BASE64_LENGTH = 15_000_000;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeConfidence(value: unknown, evidence: string): ColorimetryAnalysisData["confidence"] {
  const text = normalizeText(value).toLowerCase();
  const evidenceText = normalizeText(evidence).toLowerCase();
  const limitationSignals = [
    "pouca luz",
    "baixa luz",
    "sombra",
    "óculos",
    "ocul",
    "rosto parcial",
    "fundo dominante",
    "baixa resolução",
    "resolução baixa",
    "low light",
    "shadow",
    "glasses",
    "blur",
  ];
  const hasLimitation = limitationSignals.some((signal) => evidenceText.includes(signal));

  if (text === "low" || text === "medium" || text === "high") {
    if (text === "high" && hasLimitation) return "medium";
    return text;
  }

  return hasLimitation ? "medium" : "medium";
}

function toImageUrl(imageBase64: string) {
  const normalized = normalizeText(imageBase64);
  if (!normalized) return "";
  if (normalized.startsWith("data:image/")) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `data:image/jpeg;base64,${normalized}`;
}

function isColorShape(value: unknown): value is ColorimetryAnalysisData["faceShape"] {
  return (
    value === "oval" ||
    value === "redondo" ||
    value === "quadrado" ||
    value === "coração" ||
    value === "losango" ||
    value === "retangular" ||
    value === ""
  );
}

function parseColorimetryPayload(input: Record<string, unknown>): ColorimetryAnalysisData | null {
  const candidate: ColorimetryAnalysisData = {
    skinTone: normalizeText(input.skinTone) as ColorimetryAnalysisData["skinTone"],
    undertone: normalizeText(input.undertone) as ColorimetryAnalysisData["undertone"],
    contrast: normalizeText(input.contrast) as ColorimetryAnalysisData["contrast"],
    colorSeason: normalizeText(input.colorSeason),
    favoriteColors: normalizeStringArray(input.favoriteColors, 4),
    avoidColors: normalizeStringArray(input.avoidColors, 3),
    confidence: normalizeConfidence(
      input.confidence,
      `${normalizeText(input.evidence)} ${normalizeText(input.justification)}`.trim(),
    ),
    evidence: normalizeText(input.evidence),
    basePalette: normalizeStringArray(input.basePalette, 4),
    accentPalette: normalizeStringArray(input.accentPalette, 3),
    avoidOrUseCarefully: normalizeStringArray(input.avoidOrUseCarefully, 3),
    faceShape: isColorShape(input.faceShape) ? input.faceShape : "",
    idealNeckline: normalizeText(input.idealNeckline),
    idealFit: normalizeText(input.idealFit),
    idealFabrics: normalizeStringArray(input.idealFabrics, 3),
    avoidFabrics: normalizeStringArray(input.avoidFabrics, 2),
    justification: normalizeText(input.justification),
  };

  if (
    !candidate.skinTone ||
    !candidate.undertone ||
    !candidate.contrast ||
    !candidate.colorSeason ||
    candidate.favoriteColors.length === 0 ||
    candidate.avoidColors.length === 0 ||
    !candidate.confidence ||
    !candidate.evidence ||
    candidate.basePalette.length === 0 ||
    candidate.accentPalette.length === 0 ||
    candidate.avoidOrUseCarefully.length === 0 ||
    !candidate.faceShape ||
    !candidate.idealNeckline ||
    !candidate.idealFit ||
    candidate.idealFabrics.length === 0 ||
    candidate.avoidFabrics.length === 0 ||
    !candidate.justification
  ) {
    return null;
  }

  return candidate;
}

function fallbackResponse() {
  return NextResponse.json(FALLBACK_COLORIMETRY);
}

export async function POST(req: NextRequest) {
  let body: ColorimetryPayload;

  try {
    body = (await req.json()) as ColorimetryPayload;
  } catch (error) {
    console.warn("[analysis/colorimetry] invalid body", error);
    return fallbackResponse();
  }

  const imageBase64 = normalizeText(body.imageSource || body.imageUrl || body.imageBase64);
  const orgId = normalizeText(body.orgId);

  if (!imageBase64) {
    logSecurityEvent("warn", "missing_ai_image", { route: "analysis/colorimetry", orgId: orgId || null });
    return fallbackResponse();
  }

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    logSecurityEvent("warn", "ai_payload_too_large", {
      route: "analysis/colorimetry",
      orgId: orgId || null,
      imageLength: imageBase64.length,
      maxLength: MAX_IMAGE_BASE64_LENGTH,
    });
    return fallbackResponse();
  }

  const rateLimit = checkInMemoryRateLimit({
    scope: "colorimetry",
    request: req,
    limit: COLORIMETRY_RATE_LIMIT.limit,
    windowMs: COLORIMETRY_RATE_LIMIT.windowMs,
    keyParts: [orgId || "global"],
  });

  if (!rateLimit.allowed) {
    logSecurityEvent("warn", "rate_limit_exceeded", {
      route: "analysis/colorimetry",
      orgId: orgId || null,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
    });

    if (orgId) {
      await recordSecurityAlert(createAdminClient(), {
        orgId,
        orgSlug: null,
        eventType: "security.rate_limited",
        summary: "Colorimetry analysis rate limit exceeded",
        details: {
          route: "analysis/colorimetry",
          retry_after_seconds: rateLimit.retryAfterSeconds,
          limit: rateLimit.limit,
        },
      }).catch(() => null);
    }

    return fallbackResponse();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logSecurityEvent("warn", "missing_openai_key", { route: "analysis/colorimetry", orgId: orgId || null });
    return fallbackResponse();
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce e uma colorista profissional com 20 anos de experiencia em colorimetria pessoal e visagismo. Analise a foto e retorne APENAS JSON valido sem markdown. Não infira cores fortes como base sem justificativa visual. Se houver pouca luz, sombras, óculos escuros, rosto parcialmente oculto, fundo dominante ou baixa resolução, a confiança deve ser low ou medium, nunca high.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analise esta foto e retorne JSON com exatamente estas chaves: { skinTone: 'claro' | 'médio' | 'escuro', undertone: 'frio' | 'quente' | 'neutro', contrast: 'baixo' | 'médio' | 'alto', colorSeason: string, favoriteColors: string[] (4 cores que favorecem, nomes em português), avoidColors: string[] (3 cores que enfraquecem), confidence: 'low' | 'medium' | 'high', evidence: string (1 ou 2 frases curtas com base visual), basePalette: string[] (4 cores base seguras), accentPalette: string[] (3 cores de acento), avoidOrUseCarefully: string[] (3 cores fortes ou de cautela), faceShape: 'oval' | 'redondo' | 'quadrado' | 'coração' | 'losango' | 'retangular', idealNeckline: string, idealFit: string, idealFabrics: string[] (3 tecidos que valorizam), avoidFabrics: string[] (2 tecidos que não favorecem), justification: string (2 frases explicando a leitura) }. Cores fortes como laranja, amarelo aberto, neon, pink ou vermelho aberto só podem aparecer como accentPalette ou avoidOrUseCarefully, nunca como basePalette sem justificativa explícita e confiança high.",
            },
            {
              type: "image_url" as const,
              image_url: {
                url: toImageUrl(imageBase64),
                detail: "high" as const,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      return fallbackResponse();
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const payload = parseColorimetryPayload(parsed);
    if (!payload) {
      return fallbackResponse();
    }

    return NextResponse.json(payload);
  } catch (error) {
    logSecurityEvent("error", "analysis_failed", {
      route: "analysis/colorimetry",
      orgId: orgId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackResponse();
  }
}
