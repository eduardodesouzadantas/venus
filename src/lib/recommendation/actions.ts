"use server"

import { OnboardingData } from "@/types/onboarding";
import { ResultPayload, LookData, LookItem } from "@/types/result";
import { getB2BProducts, Product } from "@/lib/catalog";
import { generateOpenAIRecommendation } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

function generateHeuristicFallback(userData: OnboardingData, products: Product[]): ResultPayload {
  const goal = userData.intent.imageGoal || "Elegância";
  const metal = userData.colors.metal || "Prateado";
  const fit = userData.body.fit || "Slim";

  const clothes = products.filter(p => p.type === "roupa");
  const accessoriesList = products.filter(p => p.type === "acessorio");

  const getB2BPiece = (index: number, fallbackName: string): LookItem => {
    const piece = clothes[index];
    if (piece) return { id: piece.id, brand: piece.name, name: piece.category, photoUrl: piece.image_url || "" };
    return { id: `blank-${index}`, brand: "Peça Base", name: fallbackName, photoUrl: "" };
  };

  const getB2BAccessory = (index: number, fallbackName: string): string => {
    const acc = accessoriesList[index];
    if (acc) return acc.name;
    return `${fallbackName} ${metal}`;
  };

  const dominantStyle = goal === "Autoridade" ? "Alfaiataria Imponente" 
                      : goal === "Criatividade" ? "Vanguarda Urbana"
                      : "Clássico Contemporâneo";

  const looks: LookData[] = [
    {
      id: "1",
      name: "Upgrade Diário",
      intention: "Elevar base diária usando heurística.",
      type: "Híbrido Seguro",
      items: [
        { id: "i1", brand: "Seu Acervo", name: "Peça Neutra (Sua foto)", photoUrl: userData.scanner.bodyPhoto || "" },
        getB2BPiece(0, "Blazer Estruturado Premium")
      ],
      accessories: [getB2BAccessory(0, "Relógio Clássico")],
      explanation: `Mantemos a essência da foto. O Fit ${fit} amarra a proposta. (Fallback Ativado)`,
      whenToWear: "Dias casuais ou escritório."
    },
    {
      id: "2",
      name: "Assinatura Magnética",
      intention: `Projetar alta ${goal} num relance.`,
      type: "Híbrido Premium",
      items: [
        { id: "i3", brand: "Seu Acervo", name: "Bottom Base", photoUrl: "" },
        getB2BPiece(1, "Camisa Tecnológica Gola Alta"),
        getB2BPiece(2, "Sneaker Monochrome/Oxford")
      ],
      accessories: [getB2BAccessory(1, "Bolsa Minimalista"), `Metal ${metal}`],
      explanation: "A Peça B2B foca luz no rosto elevando a margem de percepção de imediato.",
      whenToWear: "Reuniões críticas."
    },
    {
      id: "3",
      name: "Ruptura Segura",
      intention: "Expansão Direcionada 100% Loja.",
      type: "Expansão Direcionada",
      items: [
        getB2BPiece(0, "Capa Fria Estruturada"),
        getB2BPiece(3, "Calça Tecido Nobre")
      ],
      accessories: [getB2BAccessory(2, "Óculos Geométrico")],
      explanation: "Expansão orientada pelas zonas de segurança do app.",
      whenToWear: "Eventos sociais rigor."
    }
  ];

  return {
    hero: {
      dominantStyle,
      subtitle: `Sua marca decodificada (Local Heuristics).`,
      coverImageUrl: "" 
    },
    palette: {
      family: "Inverno Frio Local",
      description: `Paleta usando ancoragem B2B.`,
      colors: [
        { hex: "#1A2530", name: "Navy Noturno" },
        { hex: "#F5F5DC", name: "Greige Kuro" },
        { hex: "#631A2B", name: "Bordô Imperial" },
      ],
      metal: metal,
      contrast: "Médio Alto"
    },
    diagnostic: {
      currentPerception: "Ruído visual por falta de padronagem central.",
      desiredGoal: `Projeção impecável de ${goal}.`,
      gapSolution: `Cortaremos texturas erráticas focando em Caimento ${fit}.`
    },
    bodyVisagism: {
      shoulders: `Estruture fisicamente a base dos ombros.`,
      face: userData.body.faceLines === "Marcantes" ? "Decotes V recomendados." : "Golas redondas.",
      generalFit: `Ruído necessita descompressão do tecido.`
    },
    accessories: {
      scale: accessoriesList.length > 0 ? "Marcante Híbrida" : "Minimalista Base",
      focalPoint: "Pulsos e Terço superior da clavícula.",
      advice: "Os acessórios absolutos quebram o visual básico."
    },
    looks,
    toAvoid: ["Ruídos textuais.", "Modelagens genéricas."]
  };
}

export async function generateEngineResult(userData: OnboardingData): Promise<ResultPayload> {
  const products = await getB2BProducts();

  try {
    const aiPayload = await generateOpenAIRecommendation(userData, products);
    return aiPayload;
  } catch (err) {
    console.error("OpenAI falhou. Usando Graceful Degradation Engine. Erro: ", err);
    return generateHeuristicFallback(userData, products);
  }
}

// --------------------------------------------------------------------------------------
// ACTION FIM-A-FIM: Gera o resultado e persite uma Sessão Anônima no DB retornando o ID
// --------------------------------------------------------------------------------------
export async function processAndPersistLead(userData: OnboardingData): Promise<string> {
  const result = await generateEngineResult(userData);
  
  try {
    const supabase = await createClient();
    
    // Clone userData stripping massive base64 camera blobs to prevent Vercel limits and Supabase JSON overflow
    const safeUserData = { ...userData };
    safeUserData.scanner = {
      ...userData.scanner,
      facePhoto: userData.scanner.facePhoto ? "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]" : "",
      bodyPhoto: userData.scanner.bodyPhoto ? "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]" : "",
    };

    // Insere um registro cego (anônimo) no Supabase contendo o resultado da inteligência
    const { data, error } = await supabase.from("saved_results").insert([
      {
        payload: {
          onboardingContext: safeUserData,
          finalResult: result
        }
      }
    ]).select("id").single();

    if (error || !data) {
      console.error("Erro ao salvar Dossiê Anônimo", error);
      return "MOCK_DB_FAIL"; 
    }

    return data.id;
  } catch (err) {
    console.error("Critical Exception in DB or Client creation (ENVS might be missing):", err);
    return "MOCK_DB_FAIL";
  }
}
