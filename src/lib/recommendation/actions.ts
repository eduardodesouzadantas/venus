"use server"

import { OnboardingData } from "@/types/onboarding";
import { ResultPayload } from "@/types/result";
import type { VisualAnalysisPayload } from "@/types/visual-analysis";
import { getB2BProducts, Product } from "@/lib/catalog";
import { generateOpenAIRecommendation } from "@/lib/ai";
import { buildCatalogAwareFallbackResult } from "@/lib/ai/result-normalizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractLeadSignalsFromSavedResultPayload, persistSavedResultAndLead } from "@/lib/leads";
import { buildLeadContextProfileFromOnboarding, upsertLeadContextByLeadId } from "@/lib/lead-context";
import { decideNextAction } from "@/lib/decision-engine";
import { fetchTenantBySlug, isTenantActive, normalizeTenantSlug, resolveAppTenantOrg } from "@/lib/tenant/core";
import { generateVisualProfileAnalysis } from "@/lib/analysis/visual-profile";
import {
  createProcessAndPersistLeadIdempotencyKey,
  stripOnboardingBinaryArtifacts,
} from "@/lib/reliability/idempotency";
import {
  captureOperationalTiming,
  formatOperationalReason,
  recordOperationalTenantEvent,
} from "@/lib/reliability/observability";
import {
  completeProcessingReservation,
  createProcessingOwnerToken,
  failProcessingReservation,
  reserveProcessingReservation,
  waitForProcessingReservation,
} from "@/lib/reliability/processing";

function generateHeuristicFallback(userData: OnboardingData, products: Product[]): ResultPayload {
  return buildCatalogAwareFallbackResult(userData, products);
}

export async function generateEngineResult(
  userData: OnboardingData,
  hardCapContext?: {
    orgId?: string | null;
    orgSlug?: string | null;
    eventSource?: string | null;
    visualAnalysis?: VisualAnalysisPayload | null;
    consultiveBrief?: string | null;
    org?: {
      id: string;
      slug: string;
      status: "active" | "suspended" | "blocked";
      kill_switch: boolean;
      plan_id: string | null;
    } | null;
  }
): Promise<ResultPayload> {
  const products = await getB2BProducts(hardCapContext?.orgId || null);
  const consultiveBrief = buildConsultiveBrief(userData, hardCapContext?.visualAnalysis || null);

  try {
    const aiPayload = await generateOpenAIRecommendation(userData, products, {
      ...hardCapContext,
      consultiveBrief,
    });
    return aiPayload;
  } catch (err) {
    if (err instanceof Error && (err.message.startsWith("HARD_CAP_BLOCKED:") || err.message.startsWith("TENANT_BLOCKED:"))) {
      throw err;
    }
    console.error("OpenAI falhou. Usando Graceful Degradation Engine. Erro: ", err);
    return generateHeuristicFallback(userData, products);
  }
}

function buildConsultiveBrief(userData: OnboardingData, visualAnalysis: VisualAnalysisPayload | null) {
  const colorimetry = userData.colorimetry;
  const lines: string[] = [
    "A resposta precisa soar como consultoria de imagem, não como catálogo.",
  ];

  if (visualAnalysis?.essenceLabel) {
    lines.push(`Essência visual: ${visualAnalysis.essenceLabel}.`);
  }
  if (visualAnalysis?.paletteFamily) {
    lines.push(`Paleta visual: ${visualAnalysis.paletteFamily}.`);
  }
  if (colorimetry?.colorSeason) {
    lines.push(`Colorimetria: ${colorimetry.colorSeason}.`);
  }
  if (colorimetry?.skinTone || colorimetry?.undertone || colorimetry?.contrast) {
    lines.push(
      `Pele/subtom/contraste: ${[colorimetry.skinTone, colorimetry.undertone, colorimetry.contrast].filter(Boolean).join(" / ")}.`,
    );
  }
  if (colorimetry?.faceShape || colorimetry?.idealNeckline || colorimetry?.idealFit) {
    lines.push(
      `Visagismo: rosto ${colorimetry.faceShape || "não informado"}, decote ${colorimetry.idealNeckline || "não informado"}, caimento ${colorimetry.idealFit || "não informado"}.`,
    );
  }
  if (colorimetry?.idealFabrics?.length || colorimetry?.avoidFabrics?.length) {
    lines.push(
      `Tecidos: favorecem ${colorimetry.idealFabrics?.join(", ") || "não informado"}; evitar ${colorimetry.avoidFabrics?.join(", ") || "não informado"}.`,
    );
  }

  return lines.join("\n");
}

// --------------------------------------------------------------------------------------
// ACTION FIM-A-FIM: Gera o resultado e persite uma SessÃ£o AnÃ´nima no DB retornando o ID
// --------------------------------------------------------------------------------------
export async function processAndPersistLead(userData: OnboardingData): Promise<string> {
  try {
    const supabase = createAdminClient();
    const startedAtMs = Date.now();
    const explicitOrgSlug = normalizeTenantSlug(userData.tenant?.orgSlug);
    const explicitTenant = explicitOrgSlug ? await fetchTenantBySlug(supabase, explicitOrgSlug) : null;
    const resolvedTenantResult = explicitOrgSlug
      ? explicitTenant?.org && isTenantActive(explicitTenant.org)
        ? explicitTenant
        : null
      : await resolveAppTenantOrg(supabase);

    if (!resolvedTenantResult?.org) {
      const error = new Error("TENANT_RESOLUTION_FAILED");
      console.error("[SAVED_RESULTS] unable to resolve canonical tenant for persisted result", {
        explicitOrgSlug,
        userPhone: userData.contact?.phone || null,
        userEmail: userData.contact?.email || null,
      });
      throw error;
    }

    const resolvedTenant = resolvedTenantResult as Exclude<typeof resolvedTenantResult, null> & {
      org: NonNullable<Exclude<typeof resolvedTenantResult, null>["org"]>;
      source: string;
    };

    const safeUserData = stripOnboardingBinaryArtifacts(userData);
    const idempotencyKey = createProcessAndPersistLeadIdempotencyKey({
      orgId: resolvedTenant.org.id,
      source: resolvedTenant.source,
      userData: safeUserData,
    });

    const { data: existingSavedResult, error: existingSavedResultError } = await supabase
      .from("saved_results")
      .select("id")
      .eq("org_id", resolvedTenant.org.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingSavedResultError) {
      console.warn("[SAVED_RESULTS] failed to check idempotency state", existingSavedResultError);
    }

    if (existingSavedResult?.id) {
      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.process_and_persist_succeeded",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          "existing_saved_result",
          existingSavedResult.id,
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          saved_result_id: existingSavedResult.id,
          result_source: "existing_saved_result",
          idempotency_key: idempotencyKey,
          reason_code: formatOperationalReason("persist_result", "success"),
          ...captureOperationalTiming(startedAtMs),
        },
      });
      return existingSavedResult.id;
    }

    const processingOwnerToken = createProcessingOwnerToken();
    const reservedProcessing = await reserveProcessingReservation(supabase, {
      orgId: resolvedTenant.org.id,
      reservationKey: idempotencyKey,
      ownerToken: processingOwnerToken,
      ttlSeconds: 900,
    });

    if (reservedProcessing.acquired) {
      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.processing_reservation_acquired",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          processingOwnerToken,
          reservedProcessing.status,
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          reservation_status: reservedProcessing.status,
          acquired: reservedProcessing.acquired,
          should_wait: reservedProcessing.should_wait,
          saved_result_id: reservedProcessing.saved_result_id,
          reason_code: formatOperationalReason("single_flight", "acquired"),
          ...captureOperationalTiming(startedAtMs),
        },
      });
    }

    if (reservedProcessing.status === "completed" && reservedProcessing.saved_result_id) {
      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.processing_reservation_completed",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          reservedProcessing.saved_result_id,
          "already_completed",
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          saved_result_id: reservedProcessing.saved_result_id,
          result_source: "already_completed",
          reason_code: formatOperationalReason("single_flight", "completed"),
          ...captureOperationalTiming(startedAtMs),
        },
      });
      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.process_and_persist_succeeded",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          reservedProcessing.saved_result_id,
          "already_completed",
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          saved_result_id: reservedProcessing.saved_result_id,
          result_source: "already_completed",
          idempotency_key: idempotencyKey,
          reason_code: formatOperationalReason("persist_result", "success"),
          ...captureOperationalTiming(startedAtMs),
        },
      });
      return reservedProcessing.saved_result_id;
    }

    if (!reservedProcessing.acquired) {
      const waitStartedAtMs = Date.now();
      const waitedProcessing = await waitForProcessingReservation(supabase, {
        orgId: resolvedTenant.org.id,
        reservationKey: idempotencyKey,
        ownerToken: processingOwnerToken,
        ttlSeconds: 900,
        maxWaitMs: 45_000,
        pollIntervalMs: 1_000,
      });

      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.processing_reservation_wait",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          processingOwnerToken,
          waitedProcessing?.status || "unknown",
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          reservation_status: waitedProcessing?.status || null,
          acquired: waitedProcessing?.acquired || false,
          should_wait: waitedProcessing?.should_wait || false,
          saved_result_id: waitedProcessing?.saved_result_id || null,
          wait_duration_ms: captureOperationalTiming(waitStartedAtMs).duration_ms,
          reason_code: formatOperationalReason("single_flight", "busy"),
        },
      });

      if (waitedProcessing?.acquired && waitedProcessing.status === "in_progress") {
        await recordOperationalTenantEvent(supabase, {
          orgId: resolvedTenant.org.id,
          eventSource: "app",
          eventType: "saved_result.processing_reservation_expired_reclaimed",
          dedupeKeyParts: [
            resolvedTenant.org.id,
            idempotencyKey,
            processingOwnerToken,
            "expired_reclaimed",
          ],
          payload: {
            org_id: resolvedTenant.org.id,
            reservation_key: idempotencyKey,
            owner_token: processingOwnerToken,
            reason_code: formatOperationalReason("single_flight", "expired_reclaimed"),
            ...captureOperationalTiming(startedAtMs),
          },
        });
      }

      if (waitedProcessing?.status === "completed" && waitedProcessing.saved_result_id) {
        await recordOperationalTenantEvent(supabase, {
          orgId: resolvedTenant.org.id,
          eventSource: "app",
          eventType: "saved_result.processing_reservation_completed",
          dedupeKeyParts: [
            resolvedTenant.org.id,
            idempotencyKey,
            waitedProcessing.saved_result_id,
            "wait_completed",
          ],
          payload: {
            org_id: resolvedTenant.org.id,
            reservation_key: idempotencyKey,
            owner_token: processingOwnerToken,
            saved_result_id: waitedProcessing.saved_result_id,
            result_source: "wait_completed",
            reason_code: formatOperationalReason("single_flight", "completed"),
            ...captureOperationalTiming(startedAtMs),
          },
        });
        await recordOperationalTenantEvent(supabase, {
          orgId: resolvedTenant.org.id,
          eventSource: "app",
          eventType: "saved_result.process_and_persist_succeeded",
          dedupeKeyParts: [
            resolvedTenant.org.id,
            idempotencyKey,
            waitedProcessing.saved_result_id,
            "wait_completed",
          ],
          payload: {
            org_id: resolvedTenant.org.id,
            saved_result_id: waitedProcessing.saved_result_id,
            result_source: "single_flight_completed",
            idempotency_key: idempotencyKey,
            reason_code: formatOperationalReason("persist_result", "success"),
            ...captureOperationalTiming(startedAtMs),
          },
        });
        return waitedProcessing.saved_result_id;
      }

      if (!waitedProcessing?.acquired) {
        console.warn("[SAVED_RESULTS] processing reservation still busy", {
          orgId: resolvedTenant.org.id,
          reservationKey: idempotencyKey,
        });
        await recordOperationalTenantEvent(supabase, {
          orgId: resolvedTenant.org.id,
          eventSource: "app",
          eventType: "saved_result.process_and_persist_failed",
          dedupeKeyParts: [
            resolvedTenant.org.id,
            idempotencyKey,
            processingOwnerToken,
            "busy_timeout",
          ],
          payload: {
            org_id: resolvedTenant.org.id,
            reservation_key: idempotencyKey,
            owner_token: processingOwnerToken,
            reason_code: formatOperationalReason("single_flight", "busy"),
            failure_stage: "reservation_wait_timeout",
            ...captureOperationalTiming(startedAtMs),
          },
        });
        throw new Error("PROCESSING_RESERVATION_BUSY");
      }
    }

    const generationStartedAtMs = Date.now();
    const visualAnalysis = await generateVisualProfileAnalysis(userData);
    let result: ResultPayload;
    try {
      result = await generateEngineResult(safeUserData, {
        orgId: resolvedTenant.org.id,
        orgSlug: resolvedTenant.org.slug,
        eventSource: "app",
        visualAnalysis,
        org: {
          id: resolvedTenant.org.id,
          slug: resolvedTenant.org.slug,
          status: resolvedTenant.org.status,
          kill_switch: resolvedTenant.org.kill_switch,
          plan_id: resolvedTenant.org.plan_id,
        },
      });
    } catch (err) {
      const reasonCode = err instanceof Error && err.message.startsWith("HARD_CAP_BLOCKED:")
        ? formatOperationalReason("hard_cap", "blocked")
        : err instanceof Error && err.message.startsWith("TENANT_BLOCKED:")
          ? formatOperationalReason("tenant_blocked", "blocked")
          : formatOperationalReason("single_flight", "generation_failed");

      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.processing_reservation_failed",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          processingOwnerToken,
          "generation_failed",
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          reason_code: reasonCode,
          failure_stage: "generation",
          error_message: err instanceof Error ? err.message : "unknown_failure",
          generation_duration_ms: captureOperationalTiming(generationStartedAtMs).duration_ms,
          ...captureOperationalTiming(startedAtMs),
        },
      });

      if (err instanceof Error && (err.message.startsWith("HARD_CAP_BLOCKED:") || err.message.startsWith("TENANT_BLOCKED:"))) {
        console.warn("[BILLING] saved result generation blocked by enforcement", err.message);
        await failProcessingReservation(supabase, {
          orgId: resolvedTenant.org.id,
          reservationKey: idempotencyKey,
          ownerToken: processingOwnerToken,
          errorMessage: err.message,
        }).catch((reservationError) => {
          console.warn("[SAVED_RESULTS] failed to mark processing reservation as failed", reservationError);
        });
        throw err;
      }
      await failProcessingReservation(supabase, {
        orgId: resolvedTenant.org.id,
        reservationKey: idempotencyKey,
        ownerToken: processingOwnerToken,
        errorMessage: err instanceof Error ? err.message : "unknown_failure",
      }).catch((reservationError) => {
        console.warn("[SAVED_RESULTS] failed to mark processing reservation as failed", reservationError);
      });
      throw err;
    }

    const leadSignals = extractLeadSignalsFromSavedResultPayload({
      onboardingContext: safeUserData,
      finalResult: result,
      user_email: safeUserData.contact?.email || null,
      user_name: safeUserData.contact?.name || null,
    });

    try {
      const persistStartedAtMs = Date.now();
      const persisted = await persistSavedResultAndLead(supabase, {
        orgId: resolvedTenant.org.id,
        idempotencyKey,
        userEmail: safeUserData.contact?.email || null,
        userName: safeUserData.contact?.name || null,
        payload: {
          tenant: {
            orgId: resolvedTenant.org.id,
            orgSlug: resolvedTenant.org.slug,
            branchName: resolvedTenant.org.branch_name || null,
            whatsappNumber: resolvedTenant.org.whatsapp_number || null,
            source: resolvedTenant.source,
            idempotencyKey,
          },
          onboardingContext: safeUserData,
          visualAnalysis,
          finalResult: result,
        },
        leadName: leadSignals.name || safeUserData.contact?.name || null,
        leadEmail: leadSignals.email || safeUserData.contact?.email || null,
        leadPhone: leadSignals.phone || safeUserData.contact?.phone || null,
        leadSource: "app",
        leadStatus: "new",
        intentScore: leadSignals.intentScore ?? Math.round(Number(safeUserData.intent.satisfaction || 0) * 10),
        whatsappKey: leadSignals.whatsappKey || safeUserData.contact?.phone || null,
        lastInteractionAt: leadSignals.lastInteractionAt || undefined,
        eventSource: "app",
      });

      const leadContext = await upsertLeadContextByLeadId(supabase, {
        orgId: resolvedTenant.org.id,
        leadId: persisted.leadId,
        ...buildLeadContextProfileFromOnboarding({
          data: safeUserData,
          result,
          leadName: safeUserData.contact?.name || null,
          leadPhone: safeUserData.contact?.phone || null,
          leadEmail: safeUserData.contact?.email || null,
          orgId: resolvedTenant.org.id,
          orgSlug: resolvedTenant.org.slug,
          savedResultId: persisted.savedResultId,
          intentScore: leadSignals.intentScore ?? Math.round(Number(safeUserData.intent.satisfaction || 0) * 10),
        }),
      });

      const decision = decideNextAction(leadContext);

      await upsertLeadContextByLeadId(supabase, {
        orgId: resolvedTenant.org.id,
        leadId: persisted.leadId,
        whatsappContext: {
          nextAction: decision.chosenAction,
          nextActionReason: decision.reason,
          nextActionConfidence: decision.adaptiveConfidence,
          decisionWeights: decision.weightAdjustments,
        },
      });

      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.processing_reservation_completed",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          processingOwnerToken,
          persisted.savedResultId,
          "generated_and_persisted",
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          saved_result_id: persisted.savedResultId,
          lead_id: persisted.leadId,
          result_source: "generated_and_persisted",
          reason_code: formatOperationalReason("single_flight", "completed"),
          generation_duration_ms: captureOperationalTiming(generationStartedAtMs).duration_ms,
          persist_duration_ms: captureOperationalTiming(persistStartedAtMs).duration_ms,
          ...captureOperationalTiming(startedAtMs),
        },
      });

      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.process_and_persist_succeeded",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          processingOwnerToken,
          persisted.savedResultId,
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          saved_result_id: persisted.savedResultId,
          lead_id: persisted.leadId,
          result_source: "generated_and_persisted",
          idempotency_key: idempotencyKey,
          reason_code: formatOperationalReason("persist_result", "success"),
          generation_duration_ms: captureOperationalTiming(generationStartedAtMs).duration_ms,
          persist_duration_ms: captureOperationalTiming(persistStartedAtMs).duration_ms,
          ...captureOperationalTiming(startedAtMs),
        },
      });

      await completeProcessingReservation(supabase, {
        orgId: resolvedTenant.org.id,
        reservationKey: idempotencyKey,
        ownerToken: processingOwnerToken,
        savedResultId: persisted.savedResultId,
      }).catch((reservationError) => {
        console.warn("[SAVED_RESULTS] failed to finalize processing reservation", reservationError);
      });

      return persisted.savedResultId;
    } catch (leadError) {
      await failProcessingReservation(supabase, {
        orgId: resolvedTenant.org.id,
        reservationKey: idempotencyKey,
        ownerToken: processingOwnerToken,
        errorMessage: leadError instanceof Error ? leadError.message : "persist_failure",
      }).catch((reservationError) => {
        console.warn("[SAVED_RESULTS] failed to mark processing reservation as failed", reservationError);
      });
      console.warn("[LEADS] failed to sync lead from saved result creation", leadError);
      await recordOperationalTenantEvent(supabase, {
        orgId: resolvedTenant.org.id,
        eventSource: "app",
        eventType: "saved_result.process_and_persist_failed",
        dedupeKeyParts: [
          resolvedTenant.org.id,
          idempotencyKey,
          processingOwnerToken,
          "persist_failure",
        ],
        payload: {
          org_id: resolvedTenant.org.id,
          reservation_key: idempotencyKey,
          owner_token: processingOwnerToken,
          reason_code: formatOperationalReason("single_flight", "persist_failed"),
          failure_stage: "persist",
          error_message: leadError instanceof Error ? leadError.message : "persist_failure",
          ...captureOperationalTiming(startedAtMs),
        },
      });
      throw leadError instanceof Error ? leadError : new Error("PERSISTENCE_FAILED");
    }
  } catch (err) {
    console.error("[SAVED_RESULTS] critical failure while generating/persisting lead", err);
    throw err instanceof Error ? err : new Error("CRITICAL_PERSISTENCE_FAILURE");
  }
}
