export interface LookItem {
  id: string;
  photoUrl: string;
  brand: string;
  name: string;
}

export interface LookData {
  id: string;
  name: string;
  intention: string;
  type: "Híbrido Seguro" | "Híbrido Premium" | "Expansão Direcionada";
  items: LookItem[];
  accessories: string[];
  explanation: string;
  whenToWear: string;
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
