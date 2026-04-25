import { OnboardingData } from "@/types/onboarding";
import { ResultPayload, LookData } from "@/types/result";
import { normalizeStyleDirectionPreference } from "@/lib/style-direction";
import { buildColorStyleEvidence, flattenColorStyleEvidence } from "@/lib/color-style-evidence";
import { normalizeConsultationProfile } from "@/lib/consultation-profile";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeDirection(value: string | undefined) {
  return normalizeStyleDirectionPreference(value);
}

function buildDirectionTags(direction: ReturnType<typeof normalizeDirection>) {
  if (direction === "masculine") {
    return {
      dominantStyle: "Linha masculina precisa",
      firstLook: "Blazer estruturado",
      secondLook: "Camisa limpa",
      thirdLook: "Calça reta",
      accessory: "Relógio de presença",
    };
  }

  if (direction === "feminine") {
    return {
      dominantStyle: "Linha feminina precisa",
      firstLook: "Blazer estruturado",
      secondLook: "Blusa limpa",
      thirdLook: "Calça de cintura alta",
      accessory: "Metal delicado",
    };
  }

  if (direction === "streetwear") {
    return {
      dominantStyle: "Linha streetwear precisa",
      firstLook: "Base urbana",
      secondLook: "Camada leve",
      thirdLook: "Peça de contraste",
      accessory: "Acessório de presença",
    };
  }

  if (direction === "casual") {
    return {
      dominantStyle: "Linha casual precisa",
      firstLook: "Base limpa",
      secondLook: "Camada versátil",
      thirdLook: "Peça de equilíbrio",
      accessory: "Acessório discreto",
    };
  }

  if (direction === "social") {
    return {
      dominantStyle: "Linha social precisa",
      firstLook: "Base elegante",
      secondLook: "Camada refinada",
      thirdLook: "Peça de destaque",
      accessory: "Metal polido",
    };
  }

  return {
    dominantStyle: "Linha neutra precisa",
    firstLook: "Base neutra",
    secondLook: "Camada refinada",
    thirdLook: "Peça de contraste",
    accessory: "Metal minimalista",
  };
}

// MOCKED ENGINES
// Em produção, isso serializará os dados do Onboarding e as URLs de foto no Supabase
// para disparar uma Server Action ou Edge Function consumindo a OpenAI.

export async function generateResultMock(data: OnboardingData): Promise<ResultPayload> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const goal = data.intent.imageGoal || "Elegância";
  const metal = data.colors.metal || "Prateado";
  const fit = data.body.fit || "Slim";
  const direction = normalizeDirection(data.intent.styleDirection);
  const directionTags = buildDirectionTags(direction);
  const paletteEvidence = buildColorStyleEvidence({
    styleDirection: direction,
    favoriteColors: data.colorimetry.basePalette?.length ? data.colorimetry.basePalette : data.colors.favoriteColors,
    avoidColors: data.colorimetry.avoidOrUseCarefully?.length ? data.colorimetry.avoidOrUseCarefully : data.colors.avoidColors,
    colorSeason: data.colorimetry.colorSeason || data.colors.colorSeason,
    undertone: data.colorimetry.undertone || data.colors.undertone,
    skinTone: data.colorimetry.skinTone || data.colors.skinTone,
    contrast: data.colorimetry.contrast || data.colors.contrast,
    confidence: data.colorimetry.confidence || "",
    evidence: data.colorimetry.evidence || data.colorimetry.justification || "",
  });

  const looks: LookData[] = [
    {
      id: "1",
      name: "Leitura de Base",
      intention: "Entrar com mais clareza e menos ruído.",
      type: "Híbrido Seguro",
      items: [
        { id: "i1", brand: "Seu Acervo", name: directionTags.firstLook, photoUrl: "" },
        { id: "i2", brand: "Oficina Reserva", name: direction === "feminine" ? "Blazer leve" : direction === "streetwear" ? "Jaqueta urbana" : "Sobretudo modal", photoUrl: "" },
      ],
      accessories: [directionTags.accessory],
      explanation: `A leitura respeita a linha ${direction.toLowerCase()} e usa o fit ${fit} como base de coerência.`,
      whenToWear: "Dias de rotina e encontros com baixa fricção.",
    },
    {
      id: "2",
      name: "Assinatura",
      intention: `Projetar ${goal} com presença controlada.`,
      type: "Híbrido Premium",
      items: [
        { id: "i3", brand: "Seu Acervo", name: directionTags.secondLook, photoUrl: "" },
        { id: "i4", brand: "B2B Brand", name: direction === "feminine" ? "Sandália de impacto" : direction === "social" ? "Camisa de presença" : "Tricot premium gola alta", photoUrl: "" },
        { id: "i5", brand: "Vert", name: "Acabamento monocromático", photoUrl: "" },
      ],
      accessories: [directionTags.accessory, `Micro-jóias em ${metal}`],
      explanation: `A composição sobe ${goal.toLowerCase()} sem sair da linha ${direction.toLowerCase()} e sem perder conforto.`,
      whenToWear: "Reuniões críticas ou jantares importantes.",
    },
    {
      id: "3",
      name: "Contraste Guiado",
      intention: "Sair do óbvio com direção clara.",
      type: "Expansão Direcionada",
      items: [
        { id: "i6", brand: "B2B Brand", name: directionTags.thirdLook, photoUrl: "" },
      ],
      accessories: ["Óculos statement"],
      explanation: `O ponto de impacto preserva a linha ${direction.toLowerCase()} e amplia o repertório sem misturar direção.`,
      whenToWear: "Eventos sociais e momentos de maior intenção.",
    },
  ];

  return {
    consultation: normalizeConsultationProfile(data.consultation),
    hero: {
      dominantStyle: `${directionTags.dominantStyle} • ${goal}`,
      subtitle: `A maestria da ${goal} atrelada à linha ${direction.toLowerCase()} e ao seu estilo de vida.`,
      coverImageUrl: "",
    },
    palette: {
      family: `${paletteEvidence.confidence === "high" ? "Leitura confirmada" : "Leitura preliminar"} • ${direction === "no_preference" || direction === "neutral" ? "Base neutra" : direction}`,
      description: paletteEvidence.evidence,
      colors: flattenColorStyleEvidence(paletteEvidence),
      metal: metal,
      contrast: paletteEvidence.confidence === "high" ? "Alto" : paletteEvidence.confidence === "medium" ? "Médio Alto" : "Médio",
      evidence: paletteEvidence,
    },
    diagnostic: {
      currentPerception: "Roupas usadas para camuflagem e refúgio diário, gerando apagamento em momentos-chave.",
      desiredGoal: `Projeção impecável de ${goal} através de modelagens intencionais.`,
      gapSolution: `Cortaremos os excessos de padronagem e manteremos a linha ${direction.toLowerCase()} como eixo da imagem.`,
    },
    bodyVisagism: {
      shoulders: `Estruture sempre, considerando seu desejo de fit ${fit}.`,
      face: data.body.faceLines === "Marcantes" ? "Decotes em V e golas assimétricas." : "Golas canoa e arredondadas favorecem.",
      generalFit: `Como a queixa principal foi "${data.intent.mainPain}", usaremos a fluidez a nosso favor sem perder arquitetura firme.`,
    },
    accessories: {
      scale: "Minimalista Direcionado",
      focalPoint: "Pulsos e terço superior do peito",
      advice: "Acessórios limpos. Evite excesso visual. Prefira a precisão do metal polido.",
    },
    looks,
    toAvoid: [
      "Sobreposição de mais de 3 texturas diferentes no mesmo look.",
      "Calçados que enfraquecem a intenção da linha escolhida.",
      "Modelagens que engessam as articulações.",
    ],
  };
}
