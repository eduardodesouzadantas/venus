export type VisualAnalysisStyleDirection = "Masculina" | "Feminina" | "Neutra";

export interface VisualAnalysisColor {
  hex: string;
  name: string;
}

export interface VisualAnalysisPayload {
  source: "ai" | "fallback";
  essenceLabel: string;
  essenceSummary: string;
  confidenceLabel: string;
  keySignals: string[];
  styleDirection: VisualAnalysisStyleDirection;
  paletteFamily: string;
  paletteDescription: string;
  contrast: string;
  metal: string;
  colors: VisualAnalysisColor[];
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
  hero: {
    dominantStyle: string;
    subtitle: string;
  };
  lookNames: [string, string, string];
  toAvoid: string[];
}
