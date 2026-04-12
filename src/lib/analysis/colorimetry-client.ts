"use client";

export interface ColorimetryAnalysisResponse {
  skinTone: string;
  undertone: string;
  contrast: string;
  colorSeason: string;
  colorArchetype: string;
  favoriteColors: string[];
  avoidColors: string[];
  faceShape: string;
  idealNeckline: string;
  idealFit: string;
  idealFabrics: string[];
  avoidFabrics: string[];
  justification: string;
}

function isColorArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export async function analyzeColorimetry(imageBase64: string): Promise<ColorimetryAnalysisResponse | null> {
  const response = await fetch("/api/analysis/colorimetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_base64: imageBase64 }),
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
    typeof payload.justification !== "string" ||
    !isColorArray(payload.favoriteColors) ||
    !isColorArray(payload.avoidColors)
  ) {
    return null;
  }

  return {
    skinTone: payload.skinTone,
    undertone: payload.undertone,
    contrast: payload.contrast,
    colorSeason: payload.colorSeason ?? "",
    colorArchetype: payload.colorArchetype ?? "",
    favoriteColors: payload.favoriteColors,
    avoidColors: payload.avoidColors,
    faceShape: payload.faceShape ?? "",
    idealNeckline: payload.idealNeckline ?? "",
    idealFit: payload.idealFit ?? "",
    idealFabrics: isColorArray(payload.idealFabrics) ? payload.idealFabrics : [],
    avoidFabrics: isColorArray(payload.avoidFabrics) ? payload.avoidFabrics : [],
    justification: payload.justification,
  };
}
