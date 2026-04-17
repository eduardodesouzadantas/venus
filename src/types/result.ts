export interface LookItem {
  id: string;
  product_id?: string;
  photoUrl: string;
  images?: string[]; // Multiple images support
  brand: string;
  name: string;
  price?: string;
  role?: string;
  direction?: string;
  visualWeight?: string;
  formality?: string;
  bodyEffect?: string;
  faceEffect?: string;
  
  // High-conversion / AI-enriched fields
  premiumTitle?: string;
  baseDescription?: string;
  persuasiveDescription?: string;
  impactLine?: string;
  functionalBenefit?: string;
  socialEffect?: string;
  contextOfUse?: string;
  
  // AI-ready / Enrichment metadata
  styleTags?: string[];
  categoryTags?: string[];
  fitTags?: string[];
  colorTags?: string[];
  targetProfile?: string[];
  useCases?: string[];
  
  category?: string;
  useCase?: string;
  relatedProducts?: string[]; // IDs of related products
  tryOnUrl?: string; // AI generated try-on image
  
  imageRoles?: Record<string, "front" | "back" | "side" | "detail" | "texture">; // Map photoUrl or image array indices to roles
  bundleCandidates?: string[];
  authorityRationale?: string;
  conversionCopy?: string;
  
  // Seller Helpers
  sellerSuggestions?: {
    pairsBestWith: string[];
    idealFor: string;
    buyerProfiles: string[];
    bestContext: string;
  };
  
  // OPTIMIZATION & SOCIAL PROOF
  engagementScore?: number;
  conversionRate?: number;
  isTrending?: boolean;
  isBestseller?: boolean;
  timesViewed?: number;
  timesAdded?: number;
}

export interface LookData {
  id: string;
  product_id?: string;
  name: string;
  intention: string;
  type: "Híbrido Seguro" | "Híbrido Premium" | "Expansão Direcionada";
  items: LookItem[];
  accessories: string[];
  explanation: string;
  whenToWear: string;
  
  // High Ticket Bundle
  bundlePrice?: string;
  bundleDescription?: string;
  bundleSavings?: string;
  tryOnUrl?: string; // AI generated try-on for the full look
  
  // OPTIMIZATION & SOCIAL PROOF
  popularityRank?: number;
  isDailyPick?: boolean;
  engagementScore?: number;
}

export interface PaletteEvidenceColor {
  hex: string;
  name: string;
  reason: string;
  tier: "base" | "accent" | "caution";
}

export interface PaletteEvidence {
  basePalette: PaletteEvidenceColor[];
  accentPalette: PaletteEvidenceColor[];
  avoidOrUseCarefully: PaletteEvidenceColor[];
  confidence: "low" | "medium" | "high";
  evidence: string;
}

export interface ResultPayload {
  hero: {
    dominantStyle: string;
    subtitle: string;
    coverImageUrl: string;
  };
  palette: {
    family: string;
    description: string;
    colors: { hex: string; name: string }[];
    metal: string;
    contrast: string;
    evidence: PaletteEvidence;
  };
  diagnostic: {
    currentPerception: string;
    desiredGoal: string;
    gapSolution: string;
  };
  bodyVisagism: {
    shoulders: string;
    face: string;
    generalFit: string;
  };
  accessories: {
    scale: string;
    focalPoint: string;
    advice: string;
  };
  looks: LookData[];
  toAvoid: string[];
}
