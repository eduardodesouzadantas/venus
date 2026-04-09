"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Share2, Download, RefreshCw, CheckCircle2, Camera } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { SimulatedCamera } from "./SimulatedCamera";
import { readMerchantBenefitProgram } from "@/lib/social/merchant-benefits";
import { buildTryOnPosterFile } from "@/lib/social/tryon";

interface TryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  name: string;
  brandName?: string;
  appName?: string;
  lookDescription?: string;
}

const dataUrlToFile = async (dataUrl: string, fileName: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
};

const safeFileSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "tryon";

export function TryOnModal({ isOpen, onClose, imageUrl, name, brandName, appName, lookDescription }: TryOnModalProps) {
  const { userPhoto, setUserPhoto } = useUserImage();
  const { data: onboardingData } = useOnboarding();
  const [status, setStatus] = useState<"idle" | "capturing" | "loading" | "rendering" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [showViralPrompt, setShowViralPrompt] = useState(false);
  const [currentCaption, setCurrentCaption] = useState("");
  const [generatedPosterUrl, setGeneratedPosterUrl] = useState<string>("");
  const [generatedPosterFile, setGeneratedPosterFile] = useState<File | null>(null);
  const [isBuildingPoster, setIsBuildingPoster] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSource, setGenerationSource] = useState<string>("");
  const [generationAttempts, setGenerationAttempts] = useState<number>(0);

  const styleDirection = onboardingData.intent.styleDirection || "Neutra";
  const resolvedLookDescription = lookDescription || name;
  const profileSignal = [
    onboardingData.lifestyle.purchaseDna,
    onboardingData.lifestyle.purchaseBehavior,
    onboardingData.lifestyle.environments.slice(0, 2).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const resolvedSourcePhoto = useMemo(
    () => userPhoto || onboardingData.scanner.facePhoto || onboardingData.scanner.bodyPhoto || "",
    [userPhoto, onboardingData.scanner.facePhoto, onboardingData.scanner.bodyPhoto]
  );
  const sourcePhotoRef = useRef(resolvedSourcePhoto);

  useEffect(() => {
    sourcePhotoRef.current = resolvedSourcePhoto;
  }, [resolvedSourcePhoto]);

  const merchantProgram = useMemo(() => readMerchantBenefitProgram(brandName || "Venus Engine"), [brandName]);
  const benefitTitles = useMemo(
    () => merchantProgram.benefits.map((benefit) => benefit.title.trim()).filter(Boolean).slice(0, 3),
    [merchantProgram]
  );

  const shareCaption = useMemo(() => {
    const storeName = brandName || "Venus Engine";
    const cortexName = appName || "InovaCortex";
    const storeTag = `@${storeName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase()}`;

    return [
      `Acabei de testar essa leitura com a ${storeName}.`,
      `${name} ficou mais coerente, mais desejável e mais fácil de mostrar.`,
      benefitTitles.length ? `Benefícios da loja: ${benefitTitles.join(" · ")}.` : merchantProgram.intro,
      `Marque ${storeTag} e @${appName || "InovaCortex"} ao postar.`,
      `Quer testar a Venus no seu perfil? Gere a sua leitura no app.`,
    ].join("\n\n");
  }, [appName, brandName, benefitTitles, merchantProgram.intro, name]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("idle");
      setProgress(0);
      setShowViralPrompt(false);
      setGeneratedPosterUrl("");
      setGeneratedPosterFile(null);
      setIsBuildingPoster(false);
      setGenerationError(null);
      setGenerationSource("");
      setGenerationAttempts(0);
      return;
    }

    setCurrentCaption(shareCaption);
    setGenerationError(null);
    setGenerationSource("");
    setGenerationAttempts(0);

    if (resolvedSourcePhoto) {
      if (!userPhoto) {
        setUserPhoto(resolvedSourcePhoto);
      }
      setStatus("loading");
      setProgress(0);
      setShowViralPrompt(false);
      return;
    }

    setStatus("capturing");
  }, [isOpen, resolvedSourcePhoto, shareCaption, setUserPhoto, userPhoto]);

  useEffect(() => {
    if (!isOpen || status !== "loading" || !sourcePhotoRef.current) return;

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          window.clearInterval(timer);
          setStatus("rendering");
          return 100;
        }
        return prev + 2;
      });
    }, 36);

    return () => window.clearInterval(timer);
  }, [isOpen, status]);

  useEffect(() => {
    if (!isOpen || status !== "rendering" || !sourcePhotoRef.current || !imageUrl) return;

    let active = true;
    let objectUrl: string | null = null;

    const generatePoster = async () => {
      setIsBuildingPoster(true);
      setGenerationError(null);

      try {
        const response = await fetch("/api/try-on/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userPhotoUrl: sourcePhotoRef.current,
            lookImageUrl: imageUrl,
            lookName: name,
            brandName,
            appName,
            styleDirection,
            imageGoal: onboardingData.intent.imageGoal || merchantProgram.headline,
            essenceLabel: merchantProgram.headline,
            essenceSummary: merchantProgram.intro,
            profileSignal,
            lookDescription: resolvedLookDescription,
            benefitLine: benefitTitles.length ? `Benefícios da loja: ${benefitTitles.join(" · ")}.` : merchantProgram.headline,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Falha ao gerar imagem real");
        }

        const data = (await response.json()) as {
          imageDataUrl?: string;
          modelUsed?: string;
          providerUsed?: string;
          fallbackUsed?: boolean;
          attempts?: Array<{ provider?: string; model: string; error?: string }>;
        };
        if (!data.imageDataUrl) {
          throw new Error("Falha ao receber imagem gerada");
        }

        const file = await dataUrlToFile(
          data.imageDataUrl,
          `${safeFileSlug(name)}-venus-tryon.png`
        );

        if (!active) return;
        objectUrl = URL.createObjectURL(file);
        setGeneratedPosterFile(file);
        setGeneratedPosterUrl(data.imageDataUrl);
        setGenerationAttempts(data.attempts?.length || 0);
        setGenerationSource(
          data.modelUsed
            ? `${data.providerUsed === "responses-api" ? "Responses API" : data.providerUsed === "images-api" ? "OpenAI Images" : data.providerUsed === "gemini-api" ? "Gemini" : "IA"} · ${data.fallbackUsed ? "fallback" : "principal"} · ${data.modelUsed}`
            : data.providerUsed === "images-api"
              ? "OpenAI Images"
              : data.providerUsed === "gemini-api"
                ? "Gemini"
              : "IA real"
        );
        setStatus("ready");
      } catch {
        try {
          if (!active) return;
          const fallbackFile = await buildTryOnPosterFile({
            userPhotoUrl: sourcePhotoRef.current,
            lookImageUrl: imageUrl,
            lookName: name,
            brandName,
            appName,
            benefitLine: benefitTitles.length ? `Benefícios da loja: ${benefitTitles.join(" · ")}.` : merchantProgram.headline,
            profileSignal: merchantProgram.intro,
          });
          objectUrl = URL.createObjectURL(fallbackFile);
          setGeneratedPosterFile(fallbackFile);
          setGeneratedPosterUrl(objectUrl);
          setGenerationAttempts(1);
          setGenerationSource("Fallback seguro");
          setStatus("ready");
        } catch {
          if (!active) return;
          setGeneratedPosterFile(null);
          setGeneratedPosterUrl("");
          setGenerationError("Não consegui montar sua versão agora. Tente outra foto ou refaça a captura.");
        }
      } finally {
        if (active) setIsBuildingPoster(false);
      }
    };

    void generatePoster();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    appName,
    benefitTitles,
    brandName,
    imageUrl,
    isOpen,
    merchantProgram.headline,
    merchantProgram.intro,
    name,
    onboardingData.intent.imageGoal,
    resolvedLookDescription,
    status,
    styleDirection,
  ]);

  const handleCapture = (photo: string) => {
    setUserPhoto(photo);
    setStatus("loading");
    setProgress(0);
    setShowViralPrompt(false);
    setGenerationError(null);
    setGenerationSource("");
  };

  const handleShare = async () => {
    setShowViralPrompt(true);

    try {
      if (generatedPosterFile && typeof navigator !== "undefined" && navigator.share) {
        const canShareFiles = typeof navigator.canShare === "function" ? navigator.canShare({ files: [generatedPosterFile] }) : true;

        if (canShareFiles) {
          await navigator.share({
            title: `${name} · ${brandName || "Venus Engine"}`,
            text: currentCaption,
            files: [generatedPosterFile],
            url: window.location.href,
          });
          return;
        }
      }
    } catch {
      // Falls through to fallback below.
    }

    if (navigator.share) {
      navigator
        .share({
          title: `${name} · ${brandName || "Venus Engine"}`,
          text: currentCaption,
          url: window.location.href,
        })
        .catch(() => {});
      return;
    }

    await navigator.clipboard.writeText(currentCaption);
  };

  const handleDownload = async () => {
    let file = generatedPosterFile;

    if (!file && generatedPosterUrl) {
      file = await dataUrlToFile(generatedPosterUrl, `${safeFileSlug(name)}-venus-tryon.png`);
      setGeneratedPosterFile(file);
    }

    if (!file && resolvedSourcePhoto) {
      file = await buildTryOnPosterFile({
        userPhotoUrl: resolvedSourcePhoto,
        lookImageUrl: imageUrl,
        lookName: name,
        brandName,
        appName,
        benefitLine: benefitTitles.length ? `Benefícios da loja: ${benefitTitles.join(" · ")}.` : merchantProgram.headline,
        profileSignal: merchantProgram.intro,
      });
      setGeneratedPosterFile(file);
    }

    if (!file) return;

    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRebuild = () => {
    setStatus("loading");
    setProgress(0);
    setShowViralPrompt(false);
      setGeneratedPosterUrl("");
      setGeneratedPosterFile(null);
      setGenerationError(null);
      setGenerationSource("");
      setGenerationAttempts(0);
  };

  if (!isOpen) return null;

  const isAwaitingPoster = status === "rendering" && !generatedPosterUrl && !generationError;
  const shareableLabel = benefitTitles.length
    ? `A loja define benefícios que o cliente desbloqueia ao compartilhar.`
    : "A loja define o que o cliente desbloqueia ao compartilhar.";
  const previewUrl = generatedPosterUrl || imageUrl;

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col bg-black transition-all duration-500 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className="relative z-20 flex items-center justify-between px-6 pt-12 pb-6">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-300">Hybrid AI Try-On</span>
            {userPhoto && <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
          </div>
          <span className="text-[9px] uppercase leading-none tracking-widest text-white/60">
            {status === "capturing" ? "Identificando persona" : "Gerando sua imagem real"}
          </span>
        </div>
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-transform active:scale-90">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-hidden px-6">
        {status === "capturing" ? (
          <div className="mt-10 w-full max-w-sm">
            <SimulatedCamera onCapture={handleCapture} onCancel={onClose} />
          </div>
        ) : status === "loading" ? (
          <div className="flex h-full w-full flex-col items-center justify-center space-y-10">
            <div className="relative aspect-[3/4] w-65 rounded-[40px] border border-white/10 bg-white/5 p-1">
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <img src={resolvedSourcePhoto || imageUrl} className="h-full w-full object-cover grayscale transition-all duration-1000" />

              <div className="absolute bottom-10 left-0 z-20 flex w-full flex-col items-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300/30 bg-slate-300/12">
                  <Sparkles className="h-6 w-6 text-slate-200" />
                </div>
                <Text className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-200">Montando sua versão</Text>
              </div>

              <div className="absolute top-0 left-0 z-30 h-[2px] w-full animate-scan-y bg-gradient-to-r from-transparent via-slate-200 to-transparent shadow-[0_0_20px_rgba(226,232,240,1)]" />
            </div>

            <div className="w-full max-w-[280px] space-y-4">
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-slate-300 to-slate-100 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Gerando look: {name}</span>
                <span className="text-[8px] font-mono text-slate-200">{progress}%</span>
              </div>
              <Text className="text-center text-[10px] uppercase tracking-[0.25em] text-white/35">
                {resolvedSourcePhoto ? "Usando sua foto para montar o look real." : "Capture uma foto para gerar sua versão."}
              </Text>
            </div>
          </div>
        ) : isAwaitingPoster ? (
          <div className="flex h-full w-full flex-col items-center justify-center space-y-8 py-20">
            <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[40px] border border-white/10 bg-[#0A0A0A] p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />
              <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-slate-200" />
                    <Text className="text-[9px] font-bold uppercase tracking-[0.4em] text-slate-200">Gerando imagem real</Text>
                  </div>
                  <Heading as="h3" className="max-w-[12ch] text-2xl leading-tight tracking-tighter text-white">
                    Você no look certo
                  </Heading>
                  <Text className="max-w-[20rem] text-[12px] leading-relaxed text-white/65">
                    A IA está montando sua versão com a foto real da jornada e o look escolhido.
                  </Text>
                </div>

                <div className="space-y-4">
                  <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[72%] bg-gradient-to-r from-slate-300 to-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] border border-white/10 bg-black/35 p-3">
                      <Text className="text-[8px] font-bold uppercase tracking-[0.32em] text-white/35">Linha</Text>
                      <Text className="mt-1 text-[13px] font-semibold text-white">{styleDirection}</Text>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/35 p-3">
                      <Text className="text-[8px] font-bold uppercase tracking-[0.32em] text-white/35">Foto</Text>
                      <Text className="mt-1 text-[13px] font-semibold text-white">Cliente + look</Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Text className="text-center text-[10px] uppercase tracking-[0.32em] text-white/35">
              Não estamos mostrando um mockup. Estamos gerando sua versão.
            </Text>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center overflow-y-auto pb-20 no-scrollbar">
            <div className="relative mt-4 aspect-[4/5] w-full overflow-hidden rounded-[48px] border border-white/10 bg-[#0A0A0A] shadow-[0_40px_80px_rgba(0,0,0,0.8)] group">
              {generatedPosterUrl ? (
                <img src={previewUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.2),_rgba(0,0,0,0.96)_60%)] px-8 text-center">
                  <div className="space-y-4">
                    <Sparkles className="mx-auto h-10 w-10 text-slate-200" />
                    <Heading as="h3" className="text-2xl tracking-tighter text-white">
                      Imagem pronta em instantes
                    </Heading>
                    <Text className="text-[12px] leading-relaxed text-white/70">
                      A IA está finalizando a sua versão real no look. Se algo falhar, o sistema tenta a montagem segura como fallback.
                    </Text>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              <div className="absolute top-8 left-8 flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-300/40 bg-black/40 p-0.5 backdrop-blur-md">
                  <img src={resolvedSourcePhoto || imageUrl} className="h-full w-full rounded-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white">Sua versão AI</span>
                  <span className="text-[7px] font-bold uppercase leading-none tracking-widest text-slate-200">Consistent Persona</span>
                </div>
              </div>

              <div className="absolute bottom-10 left-8 right-8">
                <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-200">
                  <Sparkles size={12} /> Look montado
                </div>
                <Heading as="h3" className="mb-4 text-2xl leading-tight tracking-tighter text-white">
                  {name}
                </Heading>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                  <Text className="text-[11px] font-medium leading-relaxed text-white/90 italic">&quot;{currentCaption}&quot;</Text>
                </div>
                {generationSource && (
                  <div className="mt-3 inline-flex rounded-full border border-slate-300/20 bg-black/50 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.26em] text-slate-200">
                    {generationSource}
                  </div>
                )}
                {generationAttempts > 0 && (
                  <div className="mt-2 inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.22em] text-white/55">
                    {generationAttempts} motor{generationAttempts > 1 ? "es" : ""} testado{generationAttempts > 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {isBuildingPoster && (
                <div className="absolute inset-x-4 bottom-4 rounded-[28px] border border-slate-300/20 bg-black/60 px-4 py-3 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-200 backdrop-blur-md">
                  Gerando imagem final para compartilhar
                </div>
              )}
            </div>

            <div className="mt-12 w-full space-y-8 rounded-[40px] border border-slate-300/20 bg-slate-300/6 p-5 sm:rounded-[48px] sm:p-8 animate-in zoom-in-95 duration-1000">
              <div className="space-y-2 text-center">
                <Heading as="h4" className="text-xl tracking-tighter uppercase">
                  Agora você já viu.
                </Heading>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-white/60 leading-relaxed">
                  Faz sentido postar esse look e destravar os benefícios da loja?
                </Text>
              </div>

              {generationError && (
                <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-center">
                  <Text className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-200">{generationError}</Text>
                </div>
              )}

              <div className="flex items-center justify-between rounded-3xl border border-white/5 bg-black px-4 py-5">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Investimento de transformação</span>
                  <span className="font-serif text-2xl tracking-widest text-slate-200">R$ 3.840,00</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-green-500">Bundle Efficient</span>
                  <span className="text-[10px] text-white/20 line-through">R$ 4.250</span>
                </div>
              </div>

              <VenusButton type="button" variant="solid" onClick={handleShare} className="h-auto w-full rounded-full bg-white px-4 py-8 text-[11px] font-bold uppercase tracking-[0.4em] text-black shadow-2xl transition-all active:scale-95">
                POSTAR AGORA
              </VenusButton>

              <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-200">
                    Postar libera pontos, sequência e os benefícios definidos pela loja
                  </span>
                </div>
                <Text className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/45">{shareableLabel}</Text>
              </div>
            </div>

            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <VenusButton onClick={handleShare} variant="outline" className="h-auto rounded-full border border-white/5 px-4 py-6 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 transition-all active:scale-95">
                <span className="flex items-center gap-2">
                  Compartilhar e destravar
                  <Share2 className="h-3 w-3 transition-transform group-hover:scale-110" />
                </span>
              </VenusButton>
              <VenusButton onClick={handleDownload} variant="outline" className="h-auto rounded-full border border-white/5 px-4 py-6 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 transition-all active:scale-95">
                <span className="flex items-center gap-2">
                  Baixar imagem
                  <Download className="h-3 w-3 transition-transform group-hover:translate-y-0.5" />
                </span>
              </VenusButton>
            </div>

            <div className="mt-6 flex w-full items-center justify-between px-2 sm:px-4">
              <button onClick={handleRebuild} className="flex items-center gap-2 text-white/10 transition-colors hover:text-white group">
                <RefreshCw className="h-3 w-3 transition-transform duration-500 group-hover:rotate-180" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Gerar nova versão</span>
              </button>
              <button onClick={() => setUserPhoto(null)} className="flex items-center gap-2 text-white/10 transition-colors hover:text-white">
                <Camera className="h-3 w-3" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Refazer foto</span>
              </button>
            </div>

            {showViralPrompt && (
              <div className="mt-12 flex flex-col items-center space-y-4 text-center animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 rounded-full border border-slate-300/20 bg-slate-300/10 px-4 py-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-200" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Estilo compartilhado</span>
                </div>
                <Text className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40">Marque a loja e @InovaCortex ao postar.</Text>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 z-0 h-[60vh] w-full bg-gradient-to-t from-slate-200/8 to-transparent" />
    </div>
  );
}
