import type { LookData } from "@/types/result";
import type { ResultSurface } from "@/lib/result/surface";
import { getStyleDirectionToneProfile, normalizeStyleDirectionPreference } from "@/lib/style-direction";

export interface ShareableLookCardVariation {
  label: string;
  title: string;
  reason: string;
  imageUrl: string | null;
}

export interface ShareableLookCardModel {
  styleName: string;
  headline: string;
  emotionalCopy: string;
  reinforcement: string[];
  question: string;
  shareCaption: string;
  opinionCaption: string;
  saveCaption: string;
  variations: ShareableLookCardVariation[];
  footerNote: string;
  brandNote: string;
  poweredByLabel: string;
}

export interface ShareableLookCardInput {
  surface: ResultSurface;
  look: LookData;
  looks?: LookData[];
  resultId?: string | null;
  resultUrl?: string | null;
  orgId?: string | null;
  brandName?: string | null;
  appName?: string | null;
  orgName?: string | null;
  storeHandle?: string | null;
  customerName?: string | null;
  userImageUrl?: string | null;
  tryOnImageUrl?: string | null;
}

const BRAND_DEFAULT = "Venus";
const APP_DEFAULT = "Venus Stylist";

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

function normalizeHandle(value: string | null | undefined): string | null {
  if (!value || value === "undefined" || value === "null") return null;
  const cleaned = value
    .replace(/^@+/, "")
    .replace(/[-\s]+/g, "")
    .replace(/[^a-zA-Z0-9_.]/g, "")
    .toLowerCase();
  return cleaned || null;
}

const trimSentence = (value: string) => normalizeText(value).replace(/[.?!\s]+$/, "");

const toLowerSentence = (value: string) => trimSentence(value).toLowerCase();

function buildShareStyleName(surface: ResultSurface, look: LookData) {
  const preference = normalizeStyleDirectionPreference(surface.essence.styleDirection);
  const cue = [
    surface.hero.dominantStyle,
    surface.essence.label,
    surface.diagnostic.desiredGoal,
    surface.diagnostic.currentPerception,
    look.name,
    look.intention,
    look.explanation,
    look.whenToWear,
  ]
    .join(" ")
    .toLowerCase();

  if (preference === "feminine") {
    return getStyleDirectionToneProfile(preference).title;
  }

  if (preference === "masculine") {
    return getStyleDirectionToneProfile(preference).title;
  }

  if (preference === "streetwear" || preference === "casual" || preference === "social") {
    return getStyleDirectionToneProfile(preference).title;
  }

  if (cue.includes("autor") || cue.includes("leader") || cue.includes("execut") || cue.includes("firme")) {
    return "Autoridade limpa";
  }

  if (cue.includes("soft") || cue.includes("leve") || cue.includes("delic") || cue.includes("romant")) {
    return "Força visual limpa";
  }

  if (cue.includes("urb") || cue.includes("city") || cue.includes("office") || cue.includes("trabalho") || cue.includes("cotidiano")) {
    return "Elegante urbano";
  }

  if (cue.includes("editor") || cue.includes("impact") || cue.includes("fashion") || cue.includes("contrast")) {
    return "Presenca editorial";
  }

  if (cue.includes("minimal") || cue.includes("clean") || cue.includes("limpo") || cue.includes("silenc")) {
    return "Minimalismo magnetico";
  }

  return "Elegante urbano";
}

function buildVariationReason(look: LookData) {
  return trimSentence(
    look.explanation ||
      look.whenToWear ||
      look.items?.[0]?.impactLine ||
      look.items?.[0]?.contextOfUse ||
      "Uma variante pronta para testar no feed."
  );
}

export function buildShareableLookCardModel(input: ShareableLookCardInput): ShareableLookCardModel {
  const brandName = normalizeText(input.brandName) || BRAND_DEFAULT;
  const appName = normalizeText(input.appName) || APP_DEFAULT;
  const storeHandle = normalizeText(input.storeHandle);
  const customerName = normalizeText(input.customerName);
  const styleName = buildShareStyleName(input.surface, input.look);
  const mainLookName = normalizeText(input.look.name) || "Look recomendado";
  const emotionalCopy =
    trimSentence(input.surface.diagnostic.gapSolution) ||
    trimSentence(input.surface.diagnostic.desiredGoal) ||
    "Esse look valoriza seu tom e estrutura.";
  const bodyLine = "Baseado na sua intenção";
  const colorLine = "Cores ideais para voce";
  const recommendationLine = "Look recomendado para voce";
  const reinforcement = [bodyLine, colorLine, recommendationLine];
  const question = "Qual voce escolheria?";
  const resultUrl = normalizeText(input.resultUrl);
  const headline = `${styleName}`;
  const storeRef = normalizeHandle(storeHandle) ? `@${normalizeHandle(storeHandle)}` : null;
  const shareCaption = [
    storeRef
      ? `Descobri minha assinatura visual com ${storeRef} usando a Venus ✨`
      : "Descobri minha assinatura visual com a Venus ✨",
    `Meu resultado foi: ${styleName}.`,
    resultUrl
      ? `Quer descobrir a sua também? Teste aqui: ${resultUrl}`
      : "Quer descobrir a sua também?",
  ].join("\n");
  const opinionCaption = trimSentence(
    [
      "Olha isso que testei 😍",
      question,
      `A leitura ficou em ${styleName.toLowerCase()} e o look principal foi ${mainLookName}.`,
      "Nunca imaginei que ficaria assim.",
      resultUrl ? resultUrl : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
  const saveCaption = trimSentence(
    [
      "Nunca imaginei que ficaria assim.",
      `Guardei meu look em ${styleName.toLowerCase()}.`,
      resultUrl ? resultUrl : null,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const variations: ShareableLookCardVariation[] = (input.looks?.length ? input.looks : [input.look])
    .slice(0, 3)
    .map((look, index) => ({
      label: `Opcao ${index + 1}`,
      title: normalizeText(look.name) || `Look ${index + 1}`,
      reason: buildVariationReason(look),
      imageUrl: look.tryOnUrl || look.items?.[0]?.tryOnUrl || look.items?.[0]?.photoUrl || input.tryOnImageUrl || input.userImageUrl || null,
    }));

  const footerNote = resultUrl ? "Qual voce escolheria? Teste e compartilhe" : "Qual voce escolheria?";
  const safeHandle = normalizeHandle(storeHandle);
  const brandNote = `${brandName}${safeHandle ? ` • @${safeHandle}` : ""}`;
  const poweredByLabel = `Powered by InovaCortex`;

  return {
    styleName,
    headline,
    emotionalCopy,
    reinforcement,
    question,
    shareCaption,
    opinionCaption,
    saveCaption,
    variations,
    footerNote,
    brandNote,
    poweredByLabel,
  };
}

async function loadCanvasImage(url?: string | null) {
  if (!url) return null;

  const normalized = normalizeText(url);
  if (!normalized) return null;

  const tryLoad = async (src: string) =>
    await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });

  if (/^(data:|blob:|\/)/i.test(normalized)) {
    return await tryLoad(normalized);
  }

  const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(normalized)}`;
  const remote = await fetch(proxiedUrl, { cache: "force-cache" }).catch(() => null);

  if (remote?.ok) {
    const blob = await remote.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await tryLoad(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return await tryLoad(proxiedUrl);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sWidth = image.width;
  let sHeight = image.height;

  if (sourceRatio > targetRatio) {
    sWidth = image.height * targetRatio;
    sx = (image.width - sWidth) / 2;
  } else {
    sHeight = image.width / targetRatio;
    sy = (image.height - sHeight) / 2;
  }

  ctx.drawImage(image, sx, sy, sWidth, sHeight, x, y, width, height);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const lines = fitText(ctx, text, maxWidth).slice(0, maxLines);

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return lines.length;
}

function buildFileName(lookName: string, resultId?: string | null) {
  const base = normalizeText(lookName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const suffix = normalizeText(resultId) ? `-${normalizeText(resultId).slice(0, 8)}` : "";
  return `${base || "venus-share-card"}${suffix}.png`;
}

async function renderShareCardBlob(input: ShareableLookCardInput, model: ShareableLookCardModel) {
  if (typeof document === "undefined") {
    throw new Error("Share card render requires a browser environment");
  }

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#060606";
  ctx.fillRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#101010");
  bg.addColorStop(0.55, "#090909");
  bg.addColorStop(1, "#18120d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.62, 170, 30, width * 0.62, 170, 420);
  glow.addColorStop(0, "rgba(212,175,55,0.28)");
  glow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const heroImage =
    (await loadCanvasImage(input.tryOnImageUrl || input.userImageUrl || input.look.tryOnUrl || input.look.items?.[0]?.tryOnUrl || input.look.items?.[0]?.photoUrl || null)) ||
    null;
  const variationImages = await Promise.all(
    model.variations.map(async (variation) => await loadCanvasImage(variation.imageUrl || null))
  );

  const heroPanel = { x: 48, y: 126, width: 984, height: 636 };
  roundRect(ctx, heroPanel.x, heroPanel.y, heroPanel.width, heroPanel.height, 42);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();

  if (heroImage) {
    ctx.save();
    roundRect(ctx, heroPanel.x, heroPanel.y, heroPanel.width, heroPanel.height, 42);
    ctx.clip();
    drawCoverImage(ctx, heroImage, heroPanel.x, heroPanel.y, heroPanel.width, heroPanel.height);
    ctx.restore();
  } else {
    const fallback = ctx.createLinearGradient(heroPanel.x, heroPanel.y, heroPanel.x + heroPanel.width, heroPanel.y + heroPanel.height);
    fallback.addColorStop(0, "#232323");
    fallback.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = fallback;
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0,0,0,0.30)";
  roundRect(ctx, heroPanel.x, heroPanel.y, heroPanel.width, heroPanel.height, 42);
  ctx.fill();

  const topBarX = 48;
  const topBarY = 44;
  roundRect(ctx, topBarX, topBarY, 360, 70, 26);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.fillStyle = "#D4AF37";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText(model.brandNote, topBarX + 26, topBarY + 31);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "500 17px Arial, sans-serif";
  ctx.fillText(model.poweredByLabel, topBarX + 26, topBarY + 56);

  roundRect(ctx, 780, topBarY, 252, 58, 22);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "600 16px Arial, sans-serif";
  ctx.fillText(model.question, 818, topBarY + 35);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 58px Georgia, 'Times New Roman', serif";
  drawWrappedText(ctx, model.headline, 78, 860, 580, 64, 2);

  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.font = "500 26px Arial, sans-serif";
  drawWrappedText(ctx, model.emotionalCopy, 78, 948, 560, 34, 3);

  roundRect(ctx, 686, 828, 346, 146, 28);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();
  ctx.fillStyle = "rgba(212,175,55,0.94)";
  ctx.font = "700 15px Arial, sans-serif";
  ctx.fillText("Reforco emocional", 712, 862);
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "600 22px Arial, sans-serif";
  drawWrappedText(ctx, "Esse look valoriza seu tom e estrutura.", 712, 902, 300, 30, 3);

  const variationY = 1044;
  const variationWidth = 304;
  const variationGap = 36;
  const variationHeight = 160;

  model.variations.forEach((variation, index) => {
    const x = 48 + index * (variationWidth + variationGap);
    roundRect(ctx, x, variationY, variationWidth, variationHeight, 28);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();

    const cardImage = variationImages[index];
    if (cardImage) {
      ctx.save();
      roundRect(ctx, x, variationY, variationWidth, variationHeight, 28);
      ctx.clip();
      drawCoverImage(ctx, cardImage, x, variationY, variationWidth, variationHeight);
      ctx.restore();
    } else {
      const fallback = ctx.createLinearGradient(x, variationY, x + variationWidth, variationY + variationHeight);
      fallback.addColorStop(0, index % 2 === 0 ? "#1f1f1f" : "#161616");
      fallback.addColorStop(1, "#0b0b0b");
      ctx.fillStyle = fallback;
      ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,0.46)";
    roundRect(ctx, x, variationY, variationWidth, variationHeight, 28);
    ctx.fill();

    ctx.fillStyle = "rgba(212,175,55,0.92)";
    ctx.font = "700 13px Arial, sans-serif";
    ctx.fillText(variation.label, x + 22, variationY + 30);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 20px Arial, sans-serif";
    drawWrappedText(ctx, variation.title, x + 22, variationY + 66, variationWidth - 44, 25, 2);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 15px Arial, sans-serif";
    drawWrappedText(ctx, variation.reason, x + 22, variationY + 120, variationWidth - 44, 18, 2);
  });

  const chipY = 1234;
  const chipWidth = 304;
  const chipGap = 36;

  model.reinforcement.forEach((item, index) => {
    const x = 48 + index * (chipWidth + chipGap);
    roundRect(ctx, x, chipY, chipWidth, 62, 24);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.fillStyle = "rgba(212,175,55,0.92)";
    ctx.font = "700 13px Arial, sans-serif";
    ctx.fillText(item.toUpperCase(), x + 22, chipY + 25);
    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.font = "500 18px Arial, sans-serif";
    ctx.fillText(item, x + 22, chipY + 47);
  });

  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = "600 18px Arial, sans-serif";
  ctx.fillText(model.footerNote, 48, 1338);
  ctx.fillStyle = "rgba(212,175,55,0.92)";
  ctx.textAlign = "right";
  ctx.fillText(model.poweredByLabel, width - 48, 1338);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate share card"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function generateShareCard(input: ShareableLookCardInput) {
  const model = buildShareableLookCardModel(input);
  const blob = await renderShareCardBlob(input, model);
  return new File([blob], buildFileName(input.look.name, input.resultId), {
    type: "image/png",
  });
}

export async function downloadShareCard(input: ShareableLookCardInput) {
  const file = await generateShareCard(input);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return file;
}

export function buildShareCardTexts(input: ShareableLookCardInput) {
  const model = buildShareableLookCardModel(input);
  return {
    model,
    shareText: model.shareCaption,
    opinionText: model.opinionCaption,
    saveText: model.saveCaption,
  };
}
