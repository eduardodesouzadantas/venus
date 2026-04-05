"use server"

import { OnboardingData } from "@/types/onboarding";
import { ResultPayload, LookData, LookItem } from "@/types/result";
import { getB2BProducts, Product } from "@/lib/catalog";
import { generateOpenAIRecommendation } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractLeadSignalsFromSavedResultPayload, findOrCreateLead } from "@/lib/leads";
import { enforceOrgHardCap } from "@/lib/billing/enforcement";
import { bumpTenantUsageDaily, resolveAppTenantOrg } from "@/lib/tenant/core";

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
  try {
    const supabase = createAdminClient();
    const resolvedTenant = await resolveAppTenantOrg(supabase);

    if (!resolvedTenant.org) {
      console.warn("[SAVED_RESULTS] unable to resolve canonical tenant for persisted result");
      return "MOCK_DB_FAIL";
    }

    const hardCapDecision = await enforceOrgHardCap({
      orgId: resolvedTenant.org.id,
      operation: "saved_result_generation",
      actorUserId: null,
      eventSource: "app",
      metadata: {
        source: resolvedTenant.source,
      },
    });

    if (!hardCapDecision.allowed) {
      console.warn("[BILLING] saved result generation blocked by hard cap", hardCapDecision);
      return `HARD_CAP_BLOCKED:${hardCapDecision.metric || "saved_result_generation"}`;
    }

    const result = await generateEngineResult(userData);

    // Clone userData stripping massive base64 camera blobs to prevent Vercel limits and Supabase JSON overflow
    const safeUserData = { ...userData };
    safeUserData.scanner = {
      ...userData.scanner,
      facePhoto: userData.scanner.facePhoto ? "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]" : "",
      bodyPhoto: userData.scanner.bodyPhoto ? "[BASE64_IMAGE_STRIPPED_FOR_STORAGE]" : "",
    };

    // Insere um registro cego (anônimo) no Supabase contendo o resultado da inteligência
    const { data, error } = await supabase
      .from("saved_results")
      .insert([
        {
          org_id: resolvedTenant.org.id,
          user_email: safeUserData.contact?.email || null,
          user_name: safeUserData.contact?.name || null,
          payload: {
            tenant: {
              orgId: resolvedTenant.org.id,
              orgSlug: resolvedTenant.org.slug,
              source: resolvedTenant.source,
            },
            onboardingContext: safeUserData,
            finalResult: result,
          },
        },
      ])
      .select("id")
      .single();

    if (error || !data) {
      console.error("Erro ao salvar Dossiê Anônimo", error);
      return "MOCK_DB_FAIL"; 
    }

    const leadSignals = extractLeadSignalsFromSavedResultPayload({
      onboardingContext: safeUserData,
      finalResult: result,
      user_email: safeUserData.contact?.email || null,
      user_name: safeUserData.contact?.name || null,
    });

    await supabase.from("tenant_events").insert({
      org_id: resolvedTenant.org.id,
      actor_user_id: null,
      event_type: "app.saved_result_created",
      event_source: "app",
      dedupe_key: `saved_result_created:${resolvedTenant.org.id}:${data.id}`,
      payload: {
        saved_result_id: data.id,
        org_slug: resolvedTenant.org.slug,
        org_source: resolvedTenant.source,
      },
    });

    try {
      const { lead, created } = await findOrCreateLead(supabase, {
        orgId: resolvedTenant.org.id,
        name: leadSignals.name || safeUserData.contact?.name || null,
        email: leadSignals.email || safeUserData.contact?.email || null,
        phone: leadSignals.phone || safeUserData.contact?.phone || null,
        source: "app",
        status: "new",
        savedResultId: data.id,
        intentScore: leadSignals.intentScore ?? Math.round(Number(safeUserData.intent.satisfaction || 0) * 10),
        whatsappKey: leadSignals.whatsappKey || safeUserData.contact?.phone || null,
        lastInteractionAt: leadSignals.lastInteractionAt || undefined,
      });

      await supabase.from("tenant_events").insert({
        org_id: resolvedTenant.org.id,
        actor_user_id: null,
        event_type: created ? "lead.created_from_app" : "lead.updated_from_app",
        event_source: "app",
        dedupe_key: `lead_from_app:${resolvedTenant.org.id}:${lead.id}:${data.id}`,
        payload: {
          lead_id: lead.id,
          saved_result_id: data.id,
          org_slug: resolvedTenant.org.slug,
          created,
        },
      });

      await bumpTenantUsageDaily(supabase, resolvedTenant.org.id, { events_count: 1, leads: created ? 1 : 0 });
    } catch (leadError) {
      console.warn("[LEADS] failed to sync lead from saved result creation", leadError);
      await bumpTenantUsageDaily(supabase, resolvedTenant.org.id, { events_count: 1 });
    }

    return data.id;
  } catch (err) {
    console.error("Critical Exception in DB or Client creation (ENVS might be missing):", err);
    return "MOCK_DB_FAIL";
  }
}
