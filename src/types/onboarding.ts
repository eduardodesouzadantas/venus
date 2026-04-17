import type { StyleDirectionPreference } from "@/lib/style-direction";

export interface OnboardingConversationData {
  line: string;
  imageGoal: string;
  styleDirection: string;
  avoidColorNote: string;
  favoriteColors: string[];
  avoidColors: string[];
}

export interface ColorimetryAnalysisData {
  skinTone: "claro" | "médio" | "escuro" | "";
  undertone: "frio" | "quente" | "neutro" | "";
  contrast: "baixo" | "médio" | "alto" | "";
  colorSeason: string;
  favoriteColors: string[];
  avoidColors: string[];
  confidence: "low" | "medium" | "high" | "";
  evidence: string;
  basePalette: string[];
  accentPalette: string[];
  avoidOrUseCarefully: string[];
  faceShape: "oval" | "redondo" | "quadrado" | "coração" | "losango" | "retangular" | "";
  idealNeckline: string;
  idealFit: string;
  idealFabrics: string[];
  avoidFabrics: string[];
  justification: string;
}

export interface OnboardingData {
  intent: {
    styleDirection: StyleDirectionPreference | "";
    imageGoal: string;
    satisfaction: number;
    mainPain: string;
  };
  lifestyle: {
    environments: string[];
    purchaseDna: string;
    purchaseBehavior: string;
  };
  colors: {
    favoriteColors: string[];
    avoidColors: string[];
    metal: "Dourado" | "Prateado" | "";
    colorSeason: string;
    skinTone: "claro" | "médio" | "escuro" | "";
    undertone: "frio" | "quente" | "neutro" | "";
    contrast: "baixo" | "médio" | "alto" | "";
    faceShape: "oval" | "redondo" | "quadrado" | "coração" | "losango" | "retangular" | "";
    idealNeckline: string;
    idealFit: string;
    idealFabrics: string[];
    avoidFabrics: string[];
  };
  body: {
    highlight: string[];
    camouflage: string[];
    fit: "Justo" | "Slim" | "Relaxed" | "Oversized" | "";
    faceLines: "Suaves" | "Marcantes" | "";
    hairLength: "Curto" | "Médio" | "Longo" | "";
  };
  scanner: {
    facePhoto: string; // Lightweight reference or temporary preview URL
    bodyPhoto: string; // Lightweight reference or temporary preview URL
    facePhotoUrl?: string;
    bodyPhotoUrl?: string;
    facePhotoPath?: string;
    bodyPhotoPath?: string;
    skipped: boolean;
  };
  colorimetry: ColorimetryAnalysisData;
  favoriteColors: string[];
  avoidColors: string[];
  colorSeason: string;
  faceShape: "oval" | "redondo" | "quadrado" | "coração" | "losango" | "retangular" | "";
  idealNeckline: string;
  idealFit: string;
  idealFabrics: string[];
  avoidFabrics: string[];
  contact?: {
    name: string;
    phone: string;
    email: string;
  };
  conversation: OnboardingConversationData;
  tenant?: {
    orgSlug?: string;
    orgId?: string;
    branchName?: string;
    whatsappNumber?: string;
  };
}

export const defaultOnboardingData: OnboardingData = {
  intent: { styleDirection: "", imageGoal: "", satisfaction: 5, mainPain: "" },
  lifestyle: { environments: [], purchaseDna: "", purchaseBehavior: "" },
  colors: {
    favoriteColors: [],
    avoidColors: [],
    metal: "",
    colorSeason: "",
    skinTone: "",
    undertone: "",
    contrast: "",
    faceShape: "",
    idealNeckline: "",
    idealFit: "",
    idealFabrics: [],
    avoidFabrics: [],
  },
  body: { highlight: [], camouflage: [], fit: "", faceLines: "", hairLength: "" },
  scanner: { facePhoto: "", bodyPhoto: "", facePhotoUrl: "", bodyPhotoUrl: "", facePhotoPath: "", bodyPhotoPath: "", skipped: false },
  colorimetry: {
    skinTone: "",
    undertone: "",
    contrast: "",
    colorSeason: "",
    favoriteColors: [],
    avoidColors: [],
    confidence: "",
    evidence: "",
    basePalette: [],
    accentPalette: [],
    avoidOrUseCarefully: [],
    faceShape: "",
    idealNeckline: "",
    idealFit: "",
    idealFabrics: [],
    avoidFabrics: [],
    justification: "",
  },
  favoriteColors: [],
  avoidColors: [],
  colorSeason: "",
  faceShape: "",
  idealNeckline: "",
  idealFit: "",
  idealFabrics: [],
  avoidFabrics: [],
  conversation: { line: "", imageGoal: "", styleDirection: "", avoidColorNote: "", favoriteColors: [], avoidColors: [] },
};
