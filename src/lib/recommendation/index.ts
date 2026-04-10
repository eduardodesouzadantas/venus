import { OnboardingData } from "@/types/onboarding";
import { ResultPayload, LookData } from "@/types/result";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeDirection(value: string | undefined): "Masculina" | "Feminina" | "Neutra" {
  const text = normalizeText(value).toLowerCase();
  if (text.includes("femin")) return "Feminina";
  if (text.includes("mascul")) return "Masculina";
  return "Neutra";
}

function buildDirectionTags(direction: "Masculina" | "Feminina" | "Neutra") {
  if (direction === "Masculina") {
    return {
      dominantStyle: "Linha masculina precisa",
      firstLook: "Blazer estruturado",
      secondLook: "Camisa limpa",
      thirdLook: "Calça reta",
      accessory: "Relógio de presença",
    };
  }

  if (direction === "Feminina") {
    return {
      dominantStyle: "Linha feminina precisa",
      firstLook: "Blazer estruturado",
      secondLook: "Blusa limpa",
      thirdLook: "Calça de cintura alta",
      accessory: "Metal delicado",
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

  const looks: LookData[] = [
    {
      id: "1",
      name: "Leitura de Base",
      intention: "Entrar com mais clareza e menos ruído.",
      type: "Híbrido Seguro",
      items: [
        { id: "i1", brand: "Seu Acervo", name: directionTags.firstLook, photoUrl: "" },
        { id: "i2", brand: "Oficina Reserva", name: direction === "Feminina" ? "Blazer leve" : "Sobretudo modal", photoUrl: "" },
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
        { id: "i4", brand: "B2B Brand", name: direction === "Feminina" ? "Sandália de impacto" : "Tricot premium gola alta", photoUrl: "" },
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
    hero: {
      dominantStyle: `${directionTags.dominantStyle} • ${goal}`,
      subtitle: `A maestria da ${goal} atrelada à linha ${direction.toLowerCase()} e ao seu estilo de vida.`,
      coverImageUrl: "",
    },
    palette: {
      family: "Inverno Frio Contrastante",
      description: `Com base nas suas seleções, a intensidade das cores precisa ancorar a sua ${goal}.`,
      colors: [
        { hex: "#1A2530", name: "Navy Noturno" },
        { hex: "#F5F5DC", name: "Greige Puro" },
        { hex: "#631A2B", name: "Bordô Imperial" },
      ],
      metal: metal,
      contrast: "Alto",
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
