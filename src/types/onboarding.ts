export interface OnboardingConversationData {
  line: "masculina" | "feminina" | "neutra" | "";
  imageGoal: string;
  styleDirection: string;
  favoriteColors: string[];
  avoidColors: string[];
}

export interface ColorimetryData {
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

export interface OnboardingData {
  intent: {
    styleDirection: "Masculina" | "Feminina" | "Neutra" | "";
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
  };
  body: {
    highlight: string[];
    camouflage: string[];
    fit: "Justo" | "Slim" | "Relaxed" | "Oversized" | "";
    faceLines: "Suaves" | "Marcantes" | "";
    hairLength: "Curto" | "Médio" | "Longo" | "";
  };
  scanner: {
    facePhoto: string; // Base64 or ObjectURL string stub
    bodyPhoto: string; // Base64 or ObjectURL string stub
    skipped: boolean;
  };
  colorimetry?: ColorimetryData;
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
  colors: { favoriteColors: [], avoidColors: [], metal: "" },
  body: { highlight: [], camouflage: [], fit: "", faceLines: "", hairLength: "" },
  scanner: { facePhoto: "", bodyPhoto: "", skipped: false },
  conversation: { line: "", imageGoal: "", styleDirection: "", favoriteColors: [], avoidColors: [] },
};
