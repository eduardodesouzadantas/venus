"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Activity, Bookmark, BrainCircuit, History, LayoutGrid, Loader2, PackageCheck, Sparkles, Target, Watch, BookOpen, AlertCircle } from "lucide-react";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { SavedProfileToast } from "@/components/ui/SavedProfileToast";
import { SaveResultsModal } from "@/components/onboarding/SaveResultsModal";
import { SocialShareActions } from "@/components/ui/SocialShareActions";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { getEngagedIds, getStatsSummary } from "@/lib/analytics/tracker";
import type { BehaviorStatsSummary } from "@/lib/analytics/tracker";
import type { UserStats } from "@/lib/ai/orchestrator";
import type { LookData } from "@/types/result";
import type { VisualAnalysisPayload } from "@/types/visual-analysis";
import { buildResultSurface, type ResultSurface } from "@/lib/result/surface";
import {
  buildWhatsAppHandoffMessage,
  buildWhatsAppHandoffPayload,
  buildWhatsAppHandoffUrl,
  getWhatsAppHandoffPhone,
} from "@/lib/whatsapp/handoff";

function inferTryOnCategory(look: LookData, item?: LookData["items"][number]): "tops" | "bottoms" | "one-pieces" {
  const source = `${look.type} ${look.name} ${item?.name || ""} ${item?.contextOfUse || ""}`.toLowerCase();
  if (source.includes("dress") || source.includes("vestido")) return "one-pieces";
  if (source.includes("calca") || source.includes("calça") || source.includes("saia") || source.includes("pants") || source.includes("skirt")) {
    return "bottoms";
  }
  return "tops";
}

function AutoTryOnPreview({
  personImageUrl,
  garmentImageUrl,
  orgId,
  category,
  lookName,
}: {
  personImageUrl: string;
  garmentImageUrl: string;
  orgId: string;
  category: "tops" | "bottoms" | "one-pieces";
  lookName: string;
}) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "processing" | "done" | "error">("idle");
  const [generatedImageUrl, setGeneratedImageUrl] = React.useState("");
  const [requestId, setRequestId] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    if (!personImageUrl || !garmentImageUrl) {
      setStatus("idle");
      setGeneratedImageUrl("");
      setRequestId("");
      setErrorMessage("");
      return;
    }

    const start = async () => {
      setStatus("loading");
      setErrorMessage("");
      setGeneratedImageUrl("");

      try {
        const response = await fetch("/api/tryon/auto", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personImageUrl,
            garmentImageUrl,
            orgId,
            category,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { status?: string; generatedImageUrl?: string; requestId?: string; error?: string }
          | null;

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(payload?.error || "Falha ao iniciar try-on");
        }

        if (payload?.generatedImageUrl) {
          setStatus("done");
          setGeneratedImageUrl(payload.generatedImageUrl);
          return;
        }

        if (payload?.requestId) {
          setStatus("processing");
          setRequestId(payload.requestId);
          return;
        }

        throw new Error("Resposta invalida do try-on");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Falha no try-on");
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [personImageUrl, garmentImageUrl, orgId, category]);

  React.useEffect(() => {
    if (status !== "processing" || !requestId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          requestId,
          orgId,
        });
        const response = await fetch(`/api/tryon/auto?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { status?: string; generatedImageUrl?: string; error?: string }
          | null;

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(payload?.error || "Falha ao consultar try-on");
        }

        if (payload?.status === "completed" && payload.generatedImageUrl) {
          setStatus("done");
          setGeneratedImageUrl(payload.generatedImageUrl);
          return;
        }

        if (payload?.status === "failed") {
          setStatus("error");
          setErrorMessage("Venus nao conseguiu gerar esse look agora.");
          return;
        }

        timer = setTimeout(() => {
          void poll();
        }, 2000);
      } catch {
        if (cancelled) return;
        timer = setTimeout(() => {
          void poll();
        }, 2500);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, requestId, orgId]);

  if (!personImageUrl || !garmentImageUrl) {
    return null;
  }

  if (status === "done" && generatedImageUrl) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.02]">
        <img src={generatedImageUrl} alt={`Try-on de ${lookName}`} className="h-auto w-full object-cover" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.02] p-4 text-center">
        <Text className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#C9A84C]">Try-on indisponível</Text>
        <Text className="mt-2 text-xs text-white/55">{errorMessage || "Tente novamente mais tarde."}</Text>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black/40 p-10 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
      <Text className="mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A84C]">GERANDO LOOK...</Text>
    </div>
  );
}

function ResultDashboardContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { data: onboardingData } = useOnboarding();
  const { userPhoto } = useUserImage();
  const [surface, setSurface] = React.useState<ResultSurface | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [tenantContext, setTenantContext] = React.useState<any>(null);

  React.useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const response = await fetch(`/api/result/${encodeURIComponent(id || "")}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Result not found");
        const payload = await response.json();
        if (payload.tenant) setTenantContext(payload.tenant);

        const builtSurface = buildResultSurface(onboardingData, payload.analysis);
        setSurface(builtSurface);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, onboardingData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
          <p className="font-mono text-[9px] tracking-[0.2em] text-[#C9A84C]">SINTONIZANDO ESSÊNCIA...</p>
        </div>
      </div>
    );
  }

  if (error || !surface) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
        <p className="text-sm text-white/40">{error || "Resultado não encontrado"}</p>
        <Link href="/" className="mt-6 text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Voltar ao início</Link>
      </div>
    );
  }

  const result = surface;
  const org = {
    name: tenantContext?.branchName || tenantContext?.orgSlug || "sua loja",
    whatsapp_phone: tenantContext?.whatsappNumber || "5511967011133"
  };

  const tryOnPersonImage = userPhoto || onboardingData.scanner.bodyPhoto || onboardingData.scanner.facePhoto || "";
  const resolvedOrgId = tenantContext?.orgId || onboardingData.tenant?.orgId || onboardingData.tenant?.orgSlug || tenantContext?.orgSlug || "";

  return (
    <main style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: "80px", color: "#f0ece4" }}>
      {/* SEÇÃO 1 — ESSÊNCIA */}
      <section style={{ padding: "24px 20px" }}>
        <p style={{ fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", color: "#C9A84C", marginBottom: "8px" }}>
          ESSÊNCIA CAPTADA
        </p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#f0ece4", fontFamily: "Georgia,serif", lineHeight: 1.2, marginBottom: "10px" }}>
          {result?.essence?.label || "Elegância Precisa"}
        </h1>
        <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.6, marginBottom: "16px" }}>
          {result?.essence?.summary}
        </p>

        {/* Card leitura personalizada */}
        <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
          <p style={{ fontSize: "8px", fontFamily: "monospace", letterSpacing: "1px", color: "#C9A84C", marginBottom: "6px" }}>LEITURA PERSONALIZADA</p>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0ece4", marginBottom: "4px" }}>
            {result?.essence?.label} • {onboardingData?.intent?.styleDirection || "Feminina"}
          </p>
          <p style={{ fontSize: "11px", color: "#666", marginBottom: "10px" }}>
            A Venus interpreta seu perfil e devolve curadoria real.
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {[onboardingData?.intent?.styleDirection, result?.essence?.label, "Curadoria real"].filter(Boolean).map((a, i) => (
              <span key={i} style={{ fontSize: "9px", padding: "3px 8px", borderRadius: "20px", background: "#1a1a1a", border: "0.5px solid #333", color: "#aaa" }}>{a}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {result?.essence?.keySignals?.map((t: string, i: number) => (
              <span key={i} style={{ fontSize: "9px", padding: "3px 8px", borderRadius: "20px", background: "#1a1200", border: "0.5px solid #C9A84C", color: "#C9A84C" }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Card de Consultoria (Stage 3) */}
        {result.diagnostic && (
          <div style={{ background: "#111", border: "1px solid #C9A84C", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
            <p style={{ fontSize: "8px", fontFamily: "monospace", letterSpacing: "1px", color: "#C9A84C", marginBottom: "10px" }}>
              CONSULTORIA DE IMAGEM COMPLETA
            </p>

            <p style={{ fontSize: "10px", color: "#888", marginBottom: "6px" }}>SUA PALETA — {result.palette.family}</p>
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              {result.palette.colors.slice(0, 4).map((cor: { hex: string; name: string }, i: number) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: "32px", borderRadius: "6px", background: cor.hex, border: "0.5px solid #333", marginBottom: "3px" }} />
                  <span style={{ fontSize: "8px", color: "#666" }}>{cor.name}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>CAIMENTO IDEAL</p>
            <p style={{ fontSize: "12px", color: "#f0ece4", marginBottom: "10px" }}>{onboardingData.body.fit || "Ajuste preciso ao corpo"}</p>

            <p style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>VISAGISMO</p>
            <p style={{ fontSize: "12px", color: "#f0ece4", marginBottom: "10px" }}>{result.palette.description?.split(".")[0] || "Linhas que valorizam sua estrutura"}</p>

            <p style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>TECIDOS QUE FAVORECEM</p>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {["Linho", "Algodão Pima", "Seda", "Lã Fria"].map((t: string, i: number) => (
                <span key={i} style={{ fontSize: "9px", padding: "3px 8px", borderRadius: "20px", background: "#1a1200", border: "0.5px solid #C9A84C", color: "#C9A84C" }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => document.getElementById("looks")?.scrollIntoView({ behavior: "smooth" })}
          style={{ width: "100%", background: "#C9A84C", color: "#0a0a0a", border: "none", borderRadius: "10px", padding: "13px", fontSize: "12px", fontWeight: 700, cursor: "pointer", letterSpacing: "1px", marginBottom: "8px" }}>
          VER MEUS LOOKS ?
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          style={{ width: "100%", background: "transparent", color: "#f0ece4", border: "0.5px solid #333", borderRadius: "10px", padding: "11px", fontSize: "12px", cursor: "pointer" }}>
          Salvar minha leitura
        </button>
      </section>

      <div style={{ height: "1px", background: "#1a1a1a", margin: "0 20px" }} />

      {/* SEÇÃO 2 — LOOKS */}
      <section id="looks" style={{ padding: "24px 20px" }}>
        <p style={{ fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", color: "#C9A84C", marginBottom: "14px" }}>
          CURADORIA PARA VOCÊ
        </p>

        <div id="tryon-result" style={{ marginBottom: "16px" }}>
          <div style={{ width: "100%", height: "320px", overflow: "hidden", borderRadius: "12px" }}>
            {result?.looks?.[0] ? (
              <AutoTryOnPreview
                personImageUrl={tryOnPersonImage}
                garmentImageUrl={result.looks[0].items[0]?.photoUrl}
                orgId={resolvedOrgId}
                category={inferTryOnCategory(result.looks[0], result.looks[0].items[0])}
                lookName={result.looks[0].name}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <div style={{ width: "24px", height: "24px", border: "2px solid #C9A84C", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: "9px", fontFamily: "monospace", letterSpacing: "1px", color: "#C9A84C" }}>A VENUS ESTÁ CRIANDO SEU LOOK...</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {result?.looks?.slice(0, 3).map((look: any, i: number) => (
            <div key={i} style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#f0ece4" }}>{look.name}</span>
                <span style={{ fontSize: "8px", padding: "2px 8px", borderRadius: "20px", background: "#1a1200", border: "0.5px solid #C9A84C", color: "#C9A84C", fontFamily: "monospace" }}>
                  {i === 0 ? "BASE" : i === 1 ? "APOIO" : "DESTAQUE"}
                </span>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {look.items?.slice(0, 2).map((item: any, j: number) => (
                  <div key={j} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} style={{ width: "72px", height: "96px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: "72px", height: "96px", background: "#1a1a1a", borderRadius: "8px", border: "0.5px solid #222", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>??</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "#f0ece4", marginBottom: "3px" }}>{item.name}</p>
                      <p style={{ fontSize: "10px", color: "#555", marginBottom: "8px" }}>{item.why || item.contextOfUse || "Combina com seu perfil visual."}</p>
                      <a href={`https://wa.me/${org.whatsapp_phone}?text=Oi! Vi o look ${look.name} e tenho interesse na peça ${item.name}`}
                        style={{ display: "block", background: "#C9A84C", color: "#0a0a0a", borderRadius: "6px", padding: "7px", fontSize: "10px", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                        Falar com a Venus ?
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: "1px", background: "#1a1a1a", margin: "0 20px" }} />

      {/* SEÇÃO 3 — COMPARTILHAR (compacto) */}
      <section style={{ padding: "24px 20px" }}>
        <p style={{ fontSize: "9px", fontFamily: "monospace", letterSpacing: "2px", color: "#C9A84C", marginBottom: "10px" }}>
          COMPARTILHAR E DESTRAVAR
        </p>
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
          Publique com marcação e desbloqueie benefícios exclusivos da loja.
        </p>
        <SocialShareActions
          look={result.looks[0]}
          styleIdentity={result.essence.label}
          imageGoal={onboardingData.intent.imageGoal}
          brandName={org.name}
          resultUrl={typeof window !== "undefined" ? window.location.href : ""}
        />
      </section>

      {/* BANNER WHATSAPP FIXO */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "56px", background: "#C9A84C", zIndex: 150,
        display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 20px"
      }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#0a0a0a" }}>
          ? A Venus está online — {org.name}
        </span>
        <a href={`https://wa.me/${org.whatsapp_phone}`}
          style={{ background: "#0a0a0a", color: "#C9A84C", borderRadius: "6px", padding: "8px 14px", fontSize: "11px", fontWeight: 700, textDecoration: "none" }}>
          Continuar no WhatsApp ?
        </a>
      </div>

      <SaveResultsModal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} surface={surface} />
    </main>
  );
}

export default function ResultDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ResultDashboardContent />
    </Suspense>
  );
}

