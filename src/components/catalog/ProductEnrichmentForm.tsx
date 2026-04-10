"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { createProduct } from "@/app/b2b/product/new/actions";

type SizeType = "clothing" | "numeric" | "shoes" | "single";

type EnrichmentResponse = {
  name?: string;
  category?: string;
  dominant_color?: string;
  style?: string;
  emotional_copy?: string;
  tags?: string[];
};

const SIZE_PRESETS: Record<SizeType, string[]> = {
  clothing: ["PP", "P", "M", "G", "GG", "GGG"],
  numeric: ["36", "38", "40", "42", "44", "46"],
  shoes: ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
  single: ["U"],
};

const ANALYSIS_STEPS = [
  "Analisando a peça...",
  "Identificando estilo...",
  "Gerando copy emocional...",
];

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAccentless(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCategory(value: string) {
  const normalized = normalizeAccentless(value);
  if (normalized.includes("acessor")) return "acessorio";
  return "roupa";
}

function normalizeStyleValue(value: string) {
  const normalized = normalizeAccentless(value);
  if (normalized.includes("alfai")) return "alfaiataria";
  if (normalized.includes("street")) return "streetwear";
  if (normalized.includes("lux")) return "festa";
  if (normalized.includes("festa")) return "festa";
  if (normalized.includes("casual")) return "casual";
  return "casual";
}

function sizeLabel(value: SizeType) {
  switch (value) {
    case "clothing":
      return "Vestuário";
    case "numeric":
      return "Numérico";
    case "shoes":
      return "Calçados";
    default:
      return "Tamanho único";
  }
}

function stockTone(quantity: number) {
  if (quantity > 5) return "green";
  if (quantity > 0) return "amber";
  return "red";
}

function StockDot({ quantity }: { quantity: number }) {
  const tone = stockTone(quantity);
  const toneMap = {
    green: "bg-[#00ff88]",
    amber: "bg-[#ffaa00]",
    red: "bg-[#ff4444]",
  };
  return <span className={`h-2.5 w-2.5 rounded-full ${toneMap[tone]}`} />;
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

function blobToObjectUrl(file: File | null) {
  return file ? URL.createObjectURL(file) : "";
}

type ProductEnrichmentFormProps = {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  returnTo: string;
  errorMessage?: string | null;
};

export function ProductEnrichmentForm({
  title,
  subtitle,
  backHref,
  backLabel,
  returnTo,
  errorMessage,
}: ProductEnrichmentFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("roupa");
  const [primaryColor, setPrimaryColor] = useState("");
  const [style, setStyle] = useState("alfaiataria");
  const [emotionalCopy, setEmotionalCopy] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [sizeType, setSizeType] = useState<SizeType>("clothing");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const previewUrlRef = useRef("");

  const sizes = useMemo(() => SIZE_PRESETS[sizeType], [sizeType]);

  useEffect(() => {
    const nextQuantities: Record<string, string> = {};
    for (const size of sizes) {
      nextQuantities[size] = quantities[size] ?? "0";
    }
    setQuantities(nextQuantities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeType]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const updateFile = (nextFile: File | null) => {
    setFile(nextFile);
    setAnalysisError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    const nextUrl = blobToObjectUrl(nextFile);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    updateFile(nextFile);
  };

  const applyEnrichment = async () => {
    if (!file || analyzing) return;

    setAnalyzing(true);
    setAnalysisError(null);
    const timer = window.setInterval(() => {
      setAnalysisStep((current) => (current + 1) % ANALYSIS_STEPS.length);
    }, 1000);

    try {
      const imageBase64 = await fileToDataUrl(file);
      const response = await fetch("/api/products/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: file.type,
          file_name: file.name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as EnrichmentResponse | null;
      if (!response.ok || !payload) {
        throw new Error(
          (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error) ||
            "Falha ao analisar a peça"
        );
      }

      if (payload.name) setName(payload.name);
      if (payload.category) setCategory(normalizeCategory(payload.category));
      if (payload.dominant_color) setPrimaryColor(payload.dominant_color);
      if (payload.style) setStyle(normalizeStyleValue(payload.style));
      if (payload.emotional_copy) setEmotionalCopy(payload.emotional_copy.slice(0, 300));
      if (Array.isArray(payload.tags)) {
        setTags(payload.tags.map(normalizeTag).filter(Boolean).slice(0, 8));
      }
    } catch (error) {
      console.error("[PRODUCT_ENRICHMENT]", error);
      setAnalysisError(error instanceof Error ? error.message : "Falha ao analisar a peça");
    } finally {
      window.clearInterval(timer);
      setAnalysisStep(0);
      setAnalyzing(false);
    }
  };

  const addTag = () => {
    const nextTag = normalizeTag(tagInput);
    if (!nextTag || tags.includes(nextTag)) return;
    setTags((current) => [...current, nextTag].slice(0, 12));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
  };

  const updateQuantity = (size: string, value: string) => {
    setQuantities((current) => ({ ...current, [size]: value.replace(/[^\d]/g, "") }));
  };

  const stockSummary = sizes.reduce(
    (acc, size) => {
      const quantity = Number(quantities[size] || 0);
      if (quantity > 5) acc.green += 1;
      else if (quantity > 0) acc.amber += 1;
      else acc.red += 1;
      return acc;
    },
    { green: 0, amber: 0, red: 0 }
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-3 rounded-full border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/45 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
            Catálogo inteligente com IA
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <form action={createProduct} encType="multipart/form-data" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6 rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
            <div className="space-y-2">
              <Text className="text-[10px] uppercase tracking-[0.35em] text-[#D4AF37]">Nova peça</Text>
              <Heading as="h1" className="text-3xl md:text-4xl tracking-tighter uppercase leading-none">
                {title}
              </Heading>
              <Text className="max-w-2xl text-sm text-white/50">{subtitle}</Text>
            </div>

            <div className="space-y-4">
              <div className="rounded-[34px] border border-dashed border-white/10 bg-black/30 p-5">
                <input
                  id="product-file"
                  name="image_file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {!previewUrl ? (
                  <label
                    htmlFor="product-file"
                    className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] text-center transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/30">
                      <ImageIcon size={28} />
                    </div>
                    <div className="space-y-1">
                      <Text className="text-xs uppercase font-bold tracking-[0.28em] text-white/40">Upload da peça</Text>
                      <Text className="text-[10px] uppercase tracking-[0.22em] text-white/25">JPG, PNG ou WEBP</Text>
                    </div>
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black">
                      <img src={previewUrl} alt="Preview da peça" className="h-[300px] w-full object-cover" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label
                        htmlFor="product-file"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/50 hover:text-white"
                      >
                        Trocar imagem
                      </label>
                      <VenusButton
                        type="button"
                        onClick={applyEnrichment}
                        disabled={analyzing}
                        variant="solid"
                        className="h-10 rounded-full bg-[#D4AF37] px-5 text-[10px] font-bold uppercase tracking-[0.24em] text-black"
                      >
                        {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {analyzing ? ANALYSIS_STEPS[analysisStep] : "Analisar com IA"}
                      </VenusButton>
                    </div>
                  </div>
                )}

                {analysisError ? <div className="mt-4 text-xs text-[#ff4444]">{analysisError}</div> : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-[0.24em] text-white/35">Nome da peça</label>
                  <input
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex: Blazer de Linho Cru"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-[0.24em] text-white/35">Categoria</label>
                  <select
                    name="category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  >
                    <option value="roupa">Roupa</option>
                    <option value="acessorio">Acessório</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-[0.24em] text-white/35">Cor dominante</label>
                  <input
                    name="primary_color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    placeholder="Ex: Bege, Preto, Navy"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-[0.24em] text-white/35">Estilo</label>
                  <select
                    name="style"
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  >
                    <option value="alfaiataria">Alfaiataria</option>
                    <option value="casual">Casual</option>
                    <option value="streetwear">Streetwear</option>
                    <option value="festa">Festa</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <Text className="text-[9px] uppercase tracking-[0.35em] text-[#D4AF37]">IA de venda</Text>
                  <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                    Copy emocional
                  </Heading>
                </div>
                <CheckCircle2 size={18} className="text-[#00ff88]" />
              </div>

              <textarea
                name="emotional_copy"
                value={emotionalCopy}
                onChange={(event) => setEmotionalCopy(event.target.value.slice(0, 300))}
                maxLength={300}
                rows={7}
                placeholder="A IA vai gerar a copy emocional aqui..."
                className="w-full rounded-[28px] border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/20 focus:border-[#D4AF37]/40"
              />
              <div className="mt-2 text-[9px] uppercase tracking-[0.22em] text-white/25">{emotionalCopy.length}/300 caracteres</div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Text className="text-[9px] uppercase tracking-[0.3em] text-white/35">Tags</Text>
                  <button
                    type="button"
                    onClick={addTag}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/45 hover:text-white"
                  >
                    <Plus size={12} />
                    Adicionar
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Ex: quiet luxury"
                    className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-[#D4AF37]/40"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/15 bg-[#D4AF37]/8 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]"
                    >
                      {tag}
                      <X size={10} />
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
              <div className="mb-4 space-y-1">
                <Text className="text-[9px] uppercase tracking-[0.35em] text-[#D4AF37]">Estoque e tamanhos</Text>
                <Heading as="h2" className="text-xl uppercase tracking-tight">
                  Grade de estoque
                </Heading>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-[0.24em] text-white/35">Tipo de grade</label>
                  <select
                    value={sizeType}
                    onChange={(event) => setSizeType(event.target.value as SizeType)}
                    className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  >
                    <option value="clothing">Vestuário</option>
                    <option value="numeric">Numérico</option>
                    <option value="shoes">Calçados</option>
                    <option value="single">Tamanho único</option>
                  </select>
                </div>

                <div className="rounded-[28px] border border-white/5 bg-black/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <Text className="text-[9px] uppercase tracking-[0.25em] text-white/35">{sizeLabel(sizeType)}</Text>
                    <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.22em] text-white/25">
                      <StockDot quantity={stockSummary.green} />
                      <span>{stockSummary.green} verde</span>
                      <span>•</span>
                      <StockDot quantity={3} />
                      <span>{stockSummary.amber} atenção</span>
                      <span>•</span>
                      <span className="text-[#ff4444]">{stockSummary.red} crítico</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {sizes.map((size) => {
                      const quantity = Number(quantities[size] || 0);
                      return (
                        <div key={size} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <div className="w-12 text-center font-mono text-sm font-bold text-[#D4AF37]">{size}</div>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={quantities[size] || "0"}
                            onChange={(event) => updateQuantity(size, event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                          />
                          <div className="min-w-20 text-right text-[9px] uppercase tracking-[0.24em] text-white/30">unidades</div>
                          <StockDot quantity={quantity} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[36px] border border-white/5 bg-white/[0.02] p-5 md:p-7">
              <div className="mb-4 space-y-1">
                <Text className="text-[9px] uppercase tracking-[0.35em] text-[#D4AF37]">Publicação</Text>
                <Heading as="h2" className="text-xl uppercase tracking-tight">
                  Salvar inventário
                </Heading>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-[0.24em] text-white/35">Link de venda opcional</label>
                  <input
                    name="external_url"
                    placeholder="https://"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  />
                </div>

                <input type="hidden" name="type" value={category} />
                <input type="hidden" name="type" value={category} />
                <input type="hidden" name="tags_json" value={JSON.stringify(tags)} />
                <input
                  type="hidden"
                  name="variants_json"
                  value={JSON.stringify(
                    sizes.map((size) => ({
                      size,
                      quantity: Number(quantities[size] || 0),
                      sku: `${sizeType}-${size}`.toLowerCase(),
                      active: true,
                    }))
                  )}
                />
                <input type="hidden" name="size_type" value={sizeType} />
                <input type="hidden" name="return_to" value={returnTo} />
              </div>

              <div className="mt-6">
                <VenusButton
                  type="submit"
                  disabled={!file}
                  variant="solid"
                  className="h-12 w-full rounded-full bg-[#D4AF37] text-black disabled:opacity-40"
                >
                  Salvar produto
                </VenusButton>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
}
