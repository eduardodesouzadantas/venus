"use client";

import type { ColorimetryAnalysisData } from "@/types/onboarding";

export type ColorimetryAnalysisResponse = ColorimetryAnalysisData;

function isColorArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isConfidence(value: unknown): value is ColorimetryAnalysisResponse["confidence"] {
  return value === "low" || value === "medium" || value === "high" || value === "";
}

function isShape(value: unknown): value is ColorimetryAnalysisData["faceShape"] {
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

export async function analyzeColorimetry(imageSource: string, orgId = ""): Promise<ColorimetryAnalysisResponse | null> {
  const response = await fetch("/api/analysis/colorimetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageSource, orgId }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as Partial<ColorimetryAnalysisResponse> | null;
  if (!payload) {
    return null;
  }

  if (
    typeof payload.skinTone !== "string" ||
    typeof payload.undertone !== "string" ||
    typeof payload.contrast !== "string" ||
    typeof payload.colorSeason !== "string" ||
    !isColorArray(payload.favoriteColors) ||
    !isColorArray(payload.avoidColors) ||
    !isConfidence(payload.confidence) ||
    typeof payload.evidence !== "string" ||
    !isColorArray(payload.basePalette) ||
    !isColorArray(payload.accentPalette) ||
    !isColorArray(payload.avoidOrUseCarefully) ||
    !isShape(payload.faceShape) ||
    typeof payload.idealNeckline !== "string" ||
    typeof payload.idealFit !== "string" ||
    !isColorArray(payload.idealFabrics) ||
    !isColorArray(payload.avoidFabrics) ||
    typeof payload.justification !== "string"
  ) {
    return null;
  }

  return {
    skinTone: payload.skinTone,
    undertone: payload.undertone,
    contrast: payload.contrast,
    colorSeason: payload.colorSeason,
    favoriteColors: payload.favoriteColors,
    avoidColors: payload.avoidColors,
    confidence: payload.confidence,
    evidence: payload.evidence,
    basePalette: payload.basePalette,
    accentPalette: payload.accentPalette,
    avoidOrUseCarefully: payload.avoidOrUseCarefully,
    faceShape: payload.faceShape,
    idealNeckline: payload.idealNeckline,
    idealFit: payload.idealFit,
    idealFabrics: payload.idealFabrics,
    avoidFabrics: payload.avoidFabrics,
    justification: payload.justification,
  };
}
