import { OnboardingData } from "@/types/onboarding";
import { ResultPayload, LookData } from "@/types/result";

// MOCKED ENGINES
// Em produção, isso serializará os dados do Onboarding e as URLs de foto no Supabase
// para disparar uma Server Action ou Edge Function consumindo a OpenAI.

export async function generateResultMock(data: OnboardingData): Promise<ResultPayload> {
  // Simulamos delay de rede
  await new Promise((resolve) => setTimeout(resolve, 800));

  const goal = data.intent.imageGoal || "Elegância";
  const metal = data.colors.metal || "Prateado";
  const fit = data.body.fit || "Slim";

  // Heuristic mock builder
  const dominantStyle = goal === "Autoridade" ? "Alfaiataria Imponente" 
                      : goal === "Criatividade" ? "Vanguarda Urbana"
                      : "Clássico Contemporâneo";

  const looks: LookData[] = [
    {
      id: "1",
      name: "Upgrade Diário",
      intention: "Elevar sua base de conforto diária com zero atrito.",
      type: "Híbrido Seguro",
      items: [
        { id: "i1", brand: "Seu Acervo", name: "Base Neutra (Sua foto)", photoUrl: "" },
        { id: "i2", brand: "Oficina Reserva", name: "Sobretudo Modal", photoUrl: "" }
      ],
      accessories: [`Relógio ${metal}`],
      explanation: `Mantemos a sua essência casual que vi na foto, mas adicionamos sofisticação térmica via B2B. O Fit ${fit} amarra a proposta.`,
      whenToWear: "Dias de escritório casual intenso."
    },
    {
      id: "2",
      name: "Assinatura Magnética",
      intention: `Projetar alta ${goal} num relance.`,
      type: "Híbrido Premium",
      items: [
        { id: "i3", brand: "Seu Acervo", name: "Calça Principal", photoUrl: "" },
        { id: "i4", brand: "Osklen", name: "Tricot Premium Gola Alta", photoUrl: "" },
        { id: "i5", brand: "Vert", name: "Sneaker Monochrome", photoUrl: "" }
      ],
      accessories: ["Bolsa Estruturada", `Micro-jóias em ${metal}`],
      explanation: "A Peça B2B foca toda luminosidade no seu rosto, acentuando traços. O tênis segura o conforto.",
      whenToWear: "Reuniões críticas ou jantares importantes."
    },
    {
      id: "3",
      name: "Ruptura Segura",
      intention: "Sair da zona de conforto com rede de segurança da inteligência.",
      type: "Expansão Direcionada",
      items: [
        { id: "i6", brand: "B2B Brand", name: "Conjunto Monocromático", photoUrl: "" }
      ],
      accessories: ["Óculos Statement"],
      explanation: "Ignoramos seu acervo para dar um choque estético 100% guiado pela cor.",
      whenToWear: "Eventos sociais de alto luxo."
    }
  ];

  return {
    hero: {
      dominantStyle,
      subtitle: `A maestria da ${goal} atrelada ao seu estilo de vida.`,
      coverImageUrl: "" // Placeholder a ser renderizado na UI css
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
      contrast: "Alto"
    },
    diagnostic: {
      currentPerception: "Roupas usadas para camuflagem e refúgio diário, gerando apagamento em eventos-chave.",
      desiredGoal: `Projeção impecável de ${goal} através de modelagens intencionais.`,
      gapSolution: `Cortaremos os excessos de padronagem, focando no Caimento ${fit} como vetor da imagem.`
    },
    bodyVisagism: {
      shoulders: `Estruture sempre, considerando seu desejo de Fit ${fit}.`,
      face: data.body.faceLines === "Marcantes" ? "Decotes em V e Golas Assimétricas." : "Golas canoa e arredondadas favorecem.",
      generalFit: `Como a queixa principal foi "${data.intent.mainPain}", usaremos a fluidez a nosso favor sem perder arquitetura firme.`
    },
    accessories: {
      scale: "Minimalista Direcionado",
      focalPoint: "Pulsos e Terço superior do peito.",
      advice: "Acessórios limpos. Evite argolas gigantes. Prefira a precisão do metal polido."
    },
    looks,
    toAvoid: [
      "Sobreposição de mais de 3 texturas diferentes no mesmo look.",
      "Calçados com bicos redondos (matam sua intenção de autoridade).",
      "Modelagens que engessam as articulações."
    ]
  };
}
