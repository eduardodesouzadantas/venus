export interface TryOnPosterInput {
  userPhotoUrl: string;
  lookImageUrl: string;
  lookName: string;
  brandName?: string;
  appName?: string;
  brandHandle?: string;
  cortexHandle?: string;
  benefitLine?: string;
  profileSignal?: string;
}

const DEFAULT_BRAND = "Maison Elite";
const DEFAULT_APP = "InovaCortex";
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

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

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

export async function buildTryOnPosterBlob(input: TryOnPosterInput) {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas nao disponivel");

  canvas.width = width;
  canvas.height = height;

  const brandName = input.brandName || DEFAULT_BRAND;
  const appName = input.appName || DEFAULT_APP;
  const brandHandle = input.brandHandle || slugHandle(brandName);
  const cortexHandle = input.cortexHandle || DEFAULT_CORTEX_HANDLE;
  const benefitLine = input.benefitLine || "Benefícios definidos pela loja";
  const profileSignal = input.profileSignal || "Sua assinatura de estilo ficou mais coerente";

  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, width, height);

  try {
    const image = await loadImage(input.lookImageUrl);
    const sourceRatio = image.width / image.height;
    const targetRatio = width / 760;
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

    ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, width, 760);
  } catch {
    const gradient = ctx.createLinearGradient(0, 0, 0, 760);
    gradient.addColorStop(0, "#181818");
    gradient.addColorStop(1, "#0A0A0A");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 760);
  }

  const topGradient = ctx.createLinearGradient(0, 0, 0, 760);
  topGradient.addColorStop(0, "rgba(0,0,0,0.12)");
  topGradient.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, 760);

  const goldGlow = ctx.createRadialGradient(width * 0.5, 150, 30, width * 0.5, 150, 420);
  goldGlow.addColorStop(0, "rgba(212,175,55,0.22)");
  goldGlow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = goldGlow;
  ctx.fillRect(0, 0, width, 760);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, 48, 48, 300, 76, 28);
  ctx.fill();
  ctx.fillStyle = "#D4AF37";
  ctx.font = "700 26px Inter, Arial, sans-serif";
  ctx.fillText(brandName, 78, 94);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 18px Inter, Arial, sans-serif";
  ctx.fillText("Look pronto para postar", 78, 120);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, 790, 48, 242, 60, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 16px Inter, Arial, sans-serif";
  ctx.fillText("InovaCortex", 852, 86);

  try {
    const userImage = await loadImage(input.userPhotoUrl);
    const size = 210;
    const x = 56;
    const y = 590;
    ctx.save();
    ctx.shadowColor = "rgba(212,175,55,0.45)";
    ctx.shadowBlur = 24;
    roundRect(ctx, x, y, size + 30, size + 30, 36);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 135, y + 135, 95, 95, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(userImage, x + 40, y + 40, 190, 190);
    ctx.restore();
  } catch {
    // If the user photo cannot be loaded, the poster still renders the look image.
  }

  const lookName = normalizeText(input.lookName);
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
  const support = fitText(ctx, `${brandName} · ${appName}`, 980);
  support.slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, 50, titleY + 18 + index * 34);
  });

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, 48, 905, 984, 58, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText(`Marque ${brandHandle} e ${cortexHandle} ao postar`, 72, 942);

  drawPill(ctx, 50, 980, 320, 72, "Efeito percebido", "Mais coerente e mais desejável");
  drawPill(ctx, 392, 980, 638, 72, "Leitura do look", input.lookName);
  drawPill(ctx, 50, 1070, 980, 72, "Leitura de personalidade", profileSignal);
  drawPill(ctx, 50, 1160, 980, 72, "Benefícios da loja", benefitLine);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText(`InovaCortex · ${appName}`, 50, 1280);
  ctx.fillStyle = "rgba(212,175,55,0.9)";
  ctx.font = "700 16px Inter, Arial, sans-serif";
  ctx.fillText("Teste a Venus antes de publicar", 750, 1280);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Falha ao gerar imagem try-on"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function buildTryOnPosterFile(input: TryOnPosterInput) {
  const blob = await buildTryOnPosterBlob(input);
  return new File([blob], `${input.lookName.replace(/\s+/g, "-").toLowerCase()}-tryon.png`, {
    type: "image/png",
  });
}
