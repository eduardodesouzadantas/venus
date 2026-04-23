import "server-only";

import OpenAI from "openai";
import { OnboardingData } from "@/types/onboarding";
import { Product } from "@/lib/catalog";
import { ResultPayload } from "@/types/result";
import type { VisualAnalysisPayload } from "@/types/visual-analysis";
import { enforceOrgHardCap } from "@/lib/billing/enforcement";
import { enforceTenantOperationalState, type TenantOperationalOrgSnapshot } from "@/lib/tenant/enforcement";
import { getTenantConfig } from "@/lib/tenant-config";
import { buildTenantBehaviorPrompt } from "@/lib/tenant-config/prompt";
import {
  buildCatalogPromptSections,
  filterCatalogForRecommendation,
  normalizeOpenAIRecommendationPayload,
  summarizeOnboardingProfile,
} from "./result-normalizer";

export * from "./conversation-engine-types";
export * from "./state-machine";
export * from "./conversation-state-detector";
export * from "./response-strategy";
export * from "./memory-integration";
export * from "./anti-exploration";
export { processConversation } from "./conversation-engine";
export type { ConversationEngineInput, ConversationEngineOutput } from "./conversation-engine";
export { buildSalesCopilotPlan } from "../whatsapp/sales-copilot";
export {
  buildFashionConsultationSnapshot,
  buildFashionConsultativeReply,
  buildFashionSummaryLine,
} from "../whatsapp/fashion-consultant";
export { buildWhatsAppStylistCommercePlan } from "../whatsapp/stylist-engine";
export type {
  WhatsAppStylistCommercePlan,
} from "../whatsapp/stylist-engine";
export type {
  FashionConsultationSnapshot,
  FashionReplyTone,
  FashionReplyAngle,
} from "../whatsapp/fashion-consultant";

export interface OpenAIRecommendationHardCapContext {
  orgId?: string | null;
  orgSlug?: string | null;
  eventSource?: string | null;
  org?: TenantOperationalOrgSnapshot | null;
  visualAnalysis?: VisualAnalysisPayload | null;
  consultiveBrief?: string | null;
}

export async function generateOpenAIRecommendation(
  userData: OnboardingData,
  catalog: Product[],
  hardCapContext?: OpenAIRecommendationHardCapContext
): Promise<ResultPayload> {
  if (hardCapContext?.orgId) {
    const operationalDecision = await enforceTenantOperationalState({
      orgId: hardCapContext.orgId,
      operation: "ai_recommendation_generation",
      eventSource: hardCapContext.eventSource || "ai",
      org: hardCapContext.org || null,
      metadata: {
        org_slug: hardCapContext.orgSlug || null,
      },
    });

    if (!operationalDecision.allowed) {
      throw new Error(`TENANT_BLOCKED:${operationalDecision.reason || "tenant_not_found"}`);
    }
  }

  if (hardCapContext?.orgId) {
    const hardCapDecision = await enforceOrgHardCap({
      orgId: hardCapContext.orgId,
      operation: "ai_recommendation_generation",
      eventSource: hardCapContext.eventSource || "ai",
      metadata: {
        org_slug: hardCapContext.orgSlug || null,
      },
    });

    if (!hardCapDecision.allowed) {
      throw new Error(`HARD_CAP_BLOCKED:${hardCapDecision.metric || "saved_results"}`);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });
  const profileSummary = summarizeOnboardingProfile(userData);
  const filteredCatalog = filterCatalogForRecommendation(catalog, userData);
  const catalogSummary = buildCatalogPromptSections(filteredCatalog, userData);
  const tenantConfig = hardCapContext?.orgId ? await getTenantConfig(hardCapContext.orgId).catch(() => null) : null;
  const tenantBehaviorPrompt = buildTenantBehaviorPrompt(tenantConfig);

  const systemPrompt = `
Você é a Venus Engine. Sua função é gerar uma leitura pessoal, precisa e comercialmente útil.

Regras:
- Use apenas os dados do perfil e o catálogo real fornecidos.
- Não invente produtos, marcas, atributos ou promessas.
- Prefira looks reais e coerentes em vez de respostas criativas demais.
- Respeite a linha de styling escolhida no onboarding e não misture peças fora dessa direção.
- Trate a preferência explícita de styleDirection como fonte de verdade para a direção de styling. Não infira gênero pela imagem como fato.
- Use a leitura visual apenas como apoio para cor, caimento, visagismo e acabamento; ela não pode substituir a styleDirection declarada.
- Explique de forma curta e clara por que cada escolha combina com o perfil, com linguagem de consultoria, visagismo e colorimetria.
- Mostre a hierarquia do look com base, apoio e destaque sem escrever demais.
- Estruture a paleta em base segura, acentos e uso com cautela; nunca coloque cores fortes como laranja, amarelo aberto, neon, pink ou vermelho aberto na base sem evidência visual forte e confiança alta.
- Justifique a paleta com o objetivo de imagem, o corpo, a colorimetria, a evidência visual e o metal informado.
- Se a confiança for baixa, seja conservador e mantenha a coerência. Se houver pouca luz, sombra, óculos escuros, rosto parcialmente oculto, fundo dominante ou baixa resolução, a leitura deve ser low ou medium, nunca high.
- Retorne apenas JSON válido, exatamente no schema solicitado.
- Monte 3 looks.

${tenantBehaviorPrompt}
`;

  const userPrompt = `
PERFIL CANÔNICO:
${profileSummary}

CAPTURA FÍSICA:
face_photo=${userData.scanner.facePhoto ? "yes" : "no"}
body_photo=${userData.scanner.bodyPhoto ? "yes" : "no"}

${hardCapContext?.visualAnalysis ? `LEITURA VISUAL POR IA:
${JSON.stringify(hardCapContext.visualAnalysis, null, 2)}

Use esta leitura visual apenas como apoio para cor, caimento e acabamento. Não permita que ela sobrescreva a styleDirection explícita ou qualquer leitura de gênero.` : ""}
${hardCapContext?.consultiveBrief ? `BRIEF CONSULTIVO:
${hardCapContext.consultiveBrief}
` : ""}
CATÁLOGO REAL RELEVANTE:
${catalogSummary}

Gere a saída final com foco em aderência ao perfil, explicação curta, hierarquia clara do look e peças reais do catálogo quando existirem.
Na paleta, prefira base neutra/sóbria quando a evidência for limitada. Cores fortes só podem aparecer como acento ou cautela.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.15,
  });

  const responseText = response.choices[0].message.content;
  if (!responseText) {
    throw new Error("OpenAI devolveu vazio.");
  }

  const payloadData = JSON.parse(responseText) as Partial<ResultPayload>;
  return normalizeOpenAIRecommendationPayload(payloadData, userData, filteredCatalog);
}
