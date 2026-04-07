import { LookData } from "@/types/result";
import { readMerchantBenefitProgram } from "@/lib/social/merchant-benefits";

export interface SocialShareInput {
  look: LookData;
  styleIdentity: string;
  imageGoal: string;
  profileSignal?: string;
  userPhotoUrl?: string | null;
  brandName?: string;
  appName?: string;
  intentScore?: number;
  resultUrl?: string;
  brandHandle?: string;
  cortexHandle?: string;
}

const DEFAULT_BRAND = "Maison Elite";
const DEFAULT_APP = "Venus Engine";
const DEFAULT_CORTEX_HANDLE = "@InovaCortex";

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/[.?!\s]+$/, "")
    .trim();

const slugHandle = (value: string) =>
  `@${value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase()
    .replace(/^@+/, "")}`;

const getBrandHandle = (input: SocialShareInput) => input.brandHandle || slugHandle(input.brandName || DEFAULT_BRAND);
const getCortexHandle = (input: SocialShareInput) => input.cortexHandle || DEFAULT_CORTEX_HANDLE;

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line);
  return lines;
};

async function loadImage(url: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadCanvasImage(url?: string | null) {
  if (!url) return null;

  const normalized = url.trim();
  if (!normalized) return null;

  if (/^(data:|blob:|\/)/i.test(normalized)) {
    try {
      return await loadImage(normalized);
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(normalized, { mode: "cors", cache: "force-cache" });
    if (!response.ok) return null;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function getEffectLine(styleIdentity: string, imageGoal: string, intentScore = 0) {
  const cue = `${styleIdentity} ${imageGoal}`.toLowerCase();

  if (intentScore >= 80 || cue.includes("autoridade") || cue.includes("lider")) {
    return "Mais firme, segura e com leitura de autoridade.";
  }

  if (cue.includes("eleg") || cue.includes("premium") || cue.includes("refin")) {
    return "Mais refinado, premium e fácil de validar.";
  }

  if (cue.includes("leve") || cue.includes("casual") || cue.includes("fresh")) {
    return "Leve, natural e pronto para o dia a dia.";
  }

  if (cue.includes("impact") || cue.includes("sensual") || cue.includes("noite")) {
    return "Com presença visual imediata.";
  }

  return "Mais coerente, comercial e pronto para postar.";
}

export function buildSocialCaption(input: SocialShareInput) {
  const brandName = input.brandName || DEFAULT_BRAND;
  const appName = input.appName || DEFAULT_APP;
  const lookName = input.look.name;
  const styleIdentity = input.styleIdentity || "uma assinatura de estilo própria";
  const imageGoal = input.imageGoal || "evoluir a imagem";
  const profileSignal = input.profileSignal?.trim();
  const brandHandle = getBrandHandle(input);
  const cortexHandle = getCortexHandle(input);
  const merchantProgram = readMerchantBenefitProgram(brandName);
  const benefitTitles = merchantProgram.benefits
    .map((benefit) => normalizeText(benefit.title))
    .filter(Boolean)
    .slice(0, 3);
  const effect = getEffectLine(styleIdentity, imageGoal, input.intentScore);
  const testLine = input.resultUrl
    ? `Teste a Venus no seu perfil: ${input.resultUrl}`
    : "Teste a Venus no seu perfil e gere a sua próxima leitura.";
  const profileLine = profileSignal
    ? `A leitura ficou alinhada com ${profileSignal}.`
    : "A leitura ficou alinhada com meu jeito de me apresentar.";
  const benefitLine = benefitTitles.length
    ? `Benefícios desta loja: ${benefitTitles.join(" · ")}.`
    : merchantProgram.intro;

  return [
    normalizeText(`Acabei de testar esta leitura com o ${appName} na ${brandName}.`),
    normalizeText(`O look ${lookName} levou a proposta para ${styleIdentity.toLowerCase()} e ficou ${effect.toLowerCase()}.`),
    normalizeText(profileLine),
    normalizeText(benefitLine),
    normalizeText(`Marque ${brandHandle} e ${cortexHandle} ao postar.`),
    normalizeText(testLine),
    `#${brandName.replace(/\s+/g, "")} #InovaCortex #VenusEngine`,
  ].join("\n\n");
}

export async function buildSocialShareImage(input: SocialShareInput) {
  const brandName = input.brandName || DEFAULT_BRAND;
  const appName = input.appName || DEFAULT_APP;
  const brandHandle = getBrandHandle(input);
  const cortexHandle = getCortexHandle(input);
  const merchantProgram = readMerchantBenefitProgram(brandName);
  const benefitTitles = merchantProgram.benefits
    .map((benefit) => normalizeText(benefit.title))
    .filter(Boolean)
    .slice(0, 3);
  const benefitLine = benefitTitles.length ? benefitTitles.join(" · ") : merchantProgram.headline;
  const lookName = normalizeText(input.look.name);
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas nao disponivel");

  canvas.width = width;
  canvas.height = height;

  const heroImageUrl = input.look.items?.[0]?.photoUrl || input.look.tryOnUrl || "/hero-final.jpg";
  const userImageUrl = input.userPhotoUrl || null;

  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, width, height);

  const heroImage = await loadCanvasImage(heroImageUrl);
  const userImage = await loadCanvasImage(userImageUrl);

  const fillCoverImage = (
    image: HTMLImageElement,
    x: number,
    y: number,
    panelWidth: number,
    panelHeight: number
  ) => {
    const sourceRatio = image.width / image.height;
    const targetRatio = panelWidth / panelHeight;
    let sWidth = image.width;
    let sHeight = image.height;
    let sx = 0;
    let sy = 0;

    if (sourceRatio > targetRatio) {
      sWidth = image.height * targetRatio;
      sx = (image.width - sWidth) / 2;
    } else {
      sHeight = image.width / targetRatio;
      sy = (image.height - sHeight) / 2;
    }

    ctx.drawImage(image, sx, sy, sWidth, sHeight, x, y, panelWidth, panelHeight);
  };

  const drawFallbackPanel = (
    x: number,
    y: number,
    panelWidth: number,
    panelHeight: number,
    label: string,
    title: string
  ) => {
    const gradient = ctx.createLinearGradient(x, y, x, y + panelHeight);
    gradient.addColorStop(0, "#181818");
    gradient.addColorStop(1, "#0A0A0A");
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, panelWidth, panelHeight, 36);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.font = "700 12px Inter, Arial, sans-serif";
    ctx.fillText(label.toUpperCase(), x + 28, y + 36);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "700 34px Georgia, 'Times New Roman', serif";
    fitText(ctx, title, panelWidth - 56).slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, x + 28, y + 88 + index * 40);
    });
  };

  // Hero split: person + look, built to survive without tainted remote draws.
  const leftPanel = { x: 48, y: 160, width: 404, height: 500 };
  const rightPanel = { x: 504, y: 160, width: 528, height: 500 };

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  roundRect(ctx, leftPanel.x, leftPanel.y, leftPanel.width, leftPanel.height, 40);
  ctx.fill();
  roundRect(ctx, rightPanel.x, rightPanel.y, rightPanel.width, rightPanel.height, 40);
  ctx.fill();

  if (userImage) {
    fillCoverImage(userImage, leftPanel.x, leftPanel.y, leftPanel.width, leftPanel.height);
  } else {
    drawFallbackPanel(leftPanel.x, leftPanel.y, leftPanel.width, leftPanel.height, "Você", "Assinatura pessoal");
  }

  if (heroImage) {
    fillCoverImage(heroImage, rightPanel.x, rightPanel.y, rightPanel.width, rightPanel.height);
  } else {
    drawFallbackPanel(rightPanel.x, rightPanel.y, rightPanel.width, rightPanel.height, "Look", lookName);
  }

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundRect(ctx, leftPanel.x, leftPanel.y, leftPanel.width, leftPanel.height, 40);
  ctx.fill();
  roundRect(ctx, rightPanel.x, rightPanel.y, rightPanel.width, rightPanel.height, 40);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.font = "700 12px Inter, Arial, sans-serif";
  ctx.fillText("VOCÊ", leftPanel.x + 28, leftPanel.y + 36);
  ctx.fillText("LOOK DA LOJA", rightPanel.x + 28, rightPanel.y + 36);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 36px Georgia, 'Times New Roman', serif";
  fitText(ctx, "Poste a sua melhor versão", leftPanel.width - 56)
    .slice(0, 3)
    .forEach((line, index) => {
      ctx.fillText(line, leftPanel.x + 28, leftPanel.y + 94 + index * 42);
    });

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "700 30px Georgia, 'Times New Roman', serif";
  fitText(ctx, lookName, rightPanel.width - 56)
    .slice(0, 3)
    .forEach((line, index) => {
      ctx.fillText(line, rightPanel.x + 28, rightPanel.y + 94 + index * 42);
    });

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, 48, 684, 984, 58, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText(`Marque ${brandHandle} e ${cortexHandle} ao postar`, 72, 721);

  const topGradient = ctx.createLinearGradient(0, 0, 0, 760);
  topGradient.addColorStop(0, "rgba(0,0,0,0)");
  topGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, 760);

  const goldGlow = ctx.createRadialGradient(width * 0.5, 150, 30, width * 0.5, 150, 420);
  goldGlow.addColorStop(0, "rgba(212,175,55,0.25)");
  goldGlow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = goldGlow;
  ctx.fillRect(0, 0, width, 760);

  // Top brand bar
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, 48, 48, 300, 76, 28);
  ctx.fill();
  ctx.fillStyle = "#D4AF37";
  ctx.font = "700 26px Inter, Arial, sans-serif";
  ctx.fillText(brandName, 78, 94);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 18px Inter, Arial, sans-serif";
  ctx.fillText("Look pronto para postar", 78, 120);

  // Top right badge
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, 790, 48, 242, 60, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 16px Inter, Arial, sans-serif";
  ctx.fillText("InovaCortex", 852, 86);

  // Title area
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 56px Georgia, 'Times New Roman', serif";
  const titleLines = fitText(ctx, lookName, 980);
  let titleY = 830;
  titleLines.slice(0, 2).forEach((line) => {
    ctx.fillText(line, 50, titleY);
    titleY += 64;
  });

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "500 26px Inter, Arial, sans-serif";
  const support = fitText(
    ctx,
    `${input.styleIdentity || "Sua assinatura de estilo"} · ${input.imageGoal || "nova leitura de imagem"}`,
    980
  );
  support.slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, 50, titleY + 18 + index * 34);
  });

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, 48, 905, 984, 58, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText(`Marque ${brandHandle} e ${cortexHandle} ao postar`, 72, 942);

  // Benefit cards
  const effectLine = getEffectLine(input.styleIdentity, input.imageGoal, input.intentScore);
  drawPill(ctx, 50, 980, 320, 72, "Efeito percebido", effectLine);

  const lookText = input.look.intention || input.look.explanation || "Uma proposta que conversa com o perfil.";
  drawPill(ctx, 392, 980, 638, 72, "Leitura do look", lookText);

  const profileText = input.profileSignal || "Perfil traduzido em uma proposta mais coerente.";
  drawPill(ctx, 50, 1070, 980, 72, "Leitura de personalidade", profileText);

  drawPill(ctx, 50, 1160, 980, 72, "Benefícios da loja", benefitLine);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText(`InovaCortex · ${appName}`, 50, 1280);
  ctx.fillStyle = "rgba(212,175,55,0.9)";
  ctx.font = "700 16px Inter, Arial, sans-serif";
  ctx.fillText("Teste a Venus antes de publicar", 750, 1280);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Falha ao gerar imagem social"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function buildSocialShareFile(input: SocialShareInput) {
  const blob = await buildSocialShareImage(input);
  return new File([blob], `${input.look.name.replace(/\s+/g, "-").toLowerCase()}-venus.png`, {
    type: "image/png",
  });
}

export async function downloadSocialShareImage(input: SocialShareInput) {
  const file = await buildSocialShareFile(input);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copySocialCaption(input: SocialShareInput) {
  const caption = buildSocialCaption(input);
  await navigator.clipboard.writeText(caption);
  return caption;
}

export async function shareSocialLook(input: SocialShareInput) {
  const caption = buildSocialCaption(input);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const file = await buildSocialShareFile(input);
      const canShareFiles = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true;

      if (canShareFiles) {
        await navigator.share({
          title: `${input.look.name} · ${input.brandName || DEFAULT_BRAND}`,
          text: caption,
          files: [file],
        });
        return { caption, shared: true };
      }
    } catch {
      // Falls through to fallback below.
    }
  }

  await copySocialCaption(input);
  await downloadSocialShareImage(input);
  return { caption, shared: false };
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

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string
) {
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  roundRect(ctx, x, y, width, height, 24);
  ctx.fill();

  ctx.fillStyle = "rgba(212,175,55,0.95)";
  ctx.font = "700 14px Inter, Arial, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 24, y + 28);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "500 18px Inter, Arial, sans-serif";
  const lines = fitText(ctx, value, width - 48);
  ctx.fillText(lines[0] || "", x + 24, y + 52);
}
