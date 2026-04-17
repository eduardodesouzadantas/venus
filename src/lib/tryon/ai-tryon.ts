import "server-only";

import OpenAI, { toFile } from "openai";
import { getStyleDirectionDisplayLabel, normalizeStyleDirectionPreference } from "@/lib/style-direction";

export interface TryOnGenerationInput {
  userPhotoUrl: string;
  lookImageUrl: string;
  lookName: string;
  brandName?: string;
  appName?: string;
  styleDirection?: string;
  imageGoal?: string;
  essenceLabel?: string;
  essenceSummary?: string;
  profileSignal?: string;
  lookDescription?: string;
  benefitLine?: string;
}

const DEFAULT_BRAND = "Venus Engine";
const DEFAULT_APP = "InovaCortex";
const DEFAULT_MODEL_CHAIN = ["gpt-image-1"];
const DEFAULT_PROVIDER_CHAIN = ["responses", "gemini", "images"];
const DEFAULT_GEMINI_MODEL_CHAIN = ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"];
const DEFAULT_TEXT_MODEL = process.env.TRYON_TEXT_MODEL?.trim() || "gpt-5.2";

const normalizeText = (value: string) => value.replace(/\s+/g, " ").replace(/[.?!\s]+$/, "").trim();

type TryOnAttempt = {
  provider: string;
  model: string;
  error?: string;
};

type TryOnGenerationResult = {
  imageDataUrl: string;
  prompt: string;
  modelUsed: string;
  providerUsed: string;
  fallbackUsed: boolean;
  attempts: TryOnAttempt[];
};

class TryOnProviderError extends Error {
  attempts: TryOnAttempt[];

  constructor(message: string, attempts: TryOnAttempt[]) {
    super(message);
    this.name = "TryOnProviderError";
    Object.setPrototypeOf(this, TryOnProviderError.prototype);
    this.attempts = attempts;
  }
}

type ResolvedImageSource = {
  bytes: Buffer;
  mimeType: string;
};

const uniqueModels = (models: string[]) => Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));

const uniqueValues = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const getTryOnModelChain = () => {
  const explicitChain = process.env.TRYON_IMAGE_MODELS?.split(",").map((model) => model.trim()).filter(Boolean);
  if (explicitChain?.length) {
    return uniqueModels(explicitChain);
  }

  const preferred = process.env.TRYON_IMAGE_MODEL?.trim();
  const baseChain = preferred ? [preferred, ...DEFAULT_MODEL_CHAIN] : DEFAULT_MODEL_CHAIN;
  return uniqueModels(baseChain);
};

const getGeminiModelChain = () => {
  const explicitChain = process.env.TRYON_GEMINI_MODELS?.split(",").map((model) => model.trim()).filter(Boolean);
  if (explicitChain?.length) {
    return uniqueValues(explicitChain);
  }

  const preferred = process.env.TRYON_GEMINI_MODEL?.trim();
  const baseChain = preferred ? [preferred, ...DEFAULT_GEMINI_MODEL_CHAIN] : DEFAULT_GEMINI_MODEL_CHAIN;
  return uniqueValues(baseChain);
};

const getTryOnProviderChain = () => {
  const explicitChain = process.env.TRYON_PROVIDERS?.split(",").map((provider) => provider.trim()).filter(Boolean);
  if (explicitChain?.length) {
    return uniqueValues(explicitChain);
  }

  const preferred = process.env.TRYON_PROVIDER?.trim();
  const baseChain = preferred ? [preferred, ...DEFAULT_PROVIDER_CHAIN] : DEFAULT_PROVIDER_CHAIN;
  return uniqueValues(baseChain);
};

const getGeminiApiKey = () => process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";

const buildPrompt = (input: TryOnGenerationInput) => {
  const brandName = input.brandName || DEFAULT_BRAND;
  const appName = input.appName || DEFAULT_APP;
  const styleDirection = normalizeStyleDirectionPreference(input.styleDirection || "Sem preferência");
  const imageGoal = input.imageGoal || "uma imagem mais assertiva e desejável";
  const essenceLabel = input.essenceLabel || "essência captada";
  const essenceSummary = input.essenceSummary || "a proposta ficou mais coerente com a pessoa";
  const profileSignal = input.profileSignal || "o perfil foi traduzido de forma mais consultiva";
  const lookDescription = input.lookDescription || input.lookName;
  const benefitLine = input.benefitLine || "benefícios desbloqueados pela loja";

  return [
    "Create a photorealistic luxury fashion editorial try-on with a portrait frame optimized for a shareable social post.",
    "Use the first image as the identity reference. Preserve the person's face, expression, skin tone, hairstyle and body proportions as faithfully as possible.",
    "Use the second image as the outfit reference. The final image must show the same person wearing the look, not a collage, not a split screen, not a mannequin, and not a poster overlay.",
    "Keep the garment silhouette, fabric feel, colors and general styling of the outfit reference, while adapting it naturally to the person's body.",
    "Compose the person as the main subject, with the look fully visible and believable on the body. The frame should feel like a premium fashion portrait, not a sticker or cutout.",
    "Style direction preference: " + getStyleDirectionDisplayLabel(styleDirection) + ". Respect this preference strictly and do not introduce cues from a different direction.",
    "Mood: high-ticket, premium, sophisticated, confident, believable, luxury editorial.",
    "Lighting: clean studio fashion lighting with subtle contrast and dark elegant background.",
    "Frame: vertical editorial portrait, centered composition, enough room to read the outfit clearly on screen.",
    "The result should feel like a real stylist's hero image, ready to post, save and share.",
    "Do not add extra people, watermark, text blocks, fake UI, cartooning or obvious AI artifacts.",
    `Brand: ${brandName}. App: ${appName}.`,
    `Image goal: ${imageGoal}.`,
    `Essence label: ${essenceLabel}.`,
    `Essence summary: ${essenceSummary}.`,
    `Profile signal: ${profileSignal}.`,
    `Look description: ${lookDescription}.`,
    `Shareable benefit cue: ${benefitLine}.`,
  ].join("\n");
};

const toDataUrl = (source: ResolvedImageSource) => `data:${source.mimeType};base64,${source.bytes.toString("base64")}`;

async function resolveUrlToBytes(source: string, baseUrl: string) {
  const normalized = source.trim();
  if (!normalized) {
    throw new Error("Missing image source");
  }

  if (normalized.startsWith("data:")) {
    const match = normalized.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) {
      throw new Error("Invalid data URL");
    }

    const mimeType = match[1] || "image/png";
    const isBase64 = !!match[2];
    const payload = match[3] || "";
    const bytes = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
    return { bytes, mimeType } satisfies ResolvedImageSource;
  }

  const absoluteUrl = new URL(normalized, baseUrl).toString();
  const response = await fetch(absoluteUrl, {
    headers: {
      Accept: "image/*",
      "User-Agent": "VenusEngine/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { bytes: buffer, mimeType: contentType } satisfies ResolvedImageSource;
}

const createImageFiles = async (userImage: ResolvedImageSource, lookImage: ResolvedImageSource) => ({
  user: await toFile(userImage.bytes, "venus-user-photo.png", { type: userImage.mimeType }),
  look: await toFile(lookImage.bytes, "venus-look-reference.png", { type: lookImage.mimeType }),
});

const buildModelOptions = (model: string) => {
  const supportsPremiumControls = model !== "gpt-image-1-mini";

  return {
    model,
    input_fidelity: supportsPremiumControls ? ("high" as const) : undefined,
    quality: supportsPremiumControls ? ("high" as const) : undefined,
    background: "auto" as const,
    size: "1024x1536" as const,
    output_format: "png" as const,
    n: 1,
  };
};

const buildImageToolOptions = (model: string) => {
  return {
    type: "image_generation" as const,
    action: "edit" as const,
    input_fidelity: model !== "gpt-image-1-mini" ? ("high" as const) : undefined,
    background: "auto" as const,
    quality: model !== "gpt-image-1-mini" ? ("high" as const) : ("auto" as const),
    size: "1024x1536" as const,
    output_format: "png" as const,
  };
};

type TryOnResponseOutputItem = {
  type?: string;
  result?: string | null;
};

const extractResponseImageBase64 = (response: { output?: TryOnResponseOutputItem[] }) => {
  const imageCall = response.output?.find((item: TryOnResponseOutputItem) => item.type === "image_generation_call");

  if (!imageCall?.result) {
    throw new Error("OpenAI Responses API did not return an image");
  }

  return imageCall.result;
};

async function generateWithResponsesApi(
  openai: OpenAI,
  input: TryOnGenerationInput,
  prompt: string,
  userImage: ResolvedImageSource,
  lookImage: ResolvedImageSource,
  modelChain: string[]
) : Promise<TryOnGenerationResult> {
  const attempts: TryOnAttempt[] = [];

  for (const model of modelChain) {
    try {
      const response = (await openai.responses.create({
        model: DEFAULT_TEXT_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You are a luxury fashion try-on engine.",
                  "Generate a single, photorealistic editorial portrait that shows the same person wearing the outfit reference.",
                  "Prioritize body fidelity, face fidelity, garment silhouette, and a premium fashion finish.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: toDataUrl(userImage), detail: "high" },
              { type: "input_image", image_url: toDataUrl(lookImage), detail: "high" },
            ],
          },
        ],
        tools: [buildImageToolOptions(model)],
        tool_choice: { type: "image_generation" },
      })) as { output?: TryOnResponseOutputItem[] };

      const imageBase64 = extractResponseImageBase64(response);

      return {
        imageDataUrl: `data:image/png;base64,${imageBase64}`,
        prompt,
        modelUsed: model,
        providerUsed: "responses-api",
        fallbackUsed: model !== modelChain[0],
        attempts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown try-on error";
      attempts.push({ provider: "responses", model, error: message });
    }
  }

  throw new TryOnProviderError(
    attempts.length
      ? `All responses API try-on models failed: ${attempts.map((attempt) => `${attempt.model}: ${attempt.error || "unknown"}`).join(" | ")}`
      : "Failed to generate try-on image with Responses API"
    ,
    attempts
  );
}

async function generateWithImagesApi(
  openai: OpenAI,
  prompt: string,
  userImage: ResolvedImageSource,
  lookImage: ResolvedImageSource,
  modelChain: string[]
) : Promise<TryOnGenerationResult> {
  const attempts: TryOnAttempt[] = [];

  for (const model of modelChain) {
    try {
      const { user, look } = await createImageFiles(userImage, lookImage);
      const response = await openai.images.edit({
        ...buildModelOptions(model),
        image: [user, look],
        prompt,
      });

      const imageBase64 = response.data?.[0]?.b64_json;
      if (!imageBase64) {
        throw new Error("OpenAI returned an empty image");
      }

      return {
        imageDataUrl: `data:image/png;base64,${imageBase64}`,
        prompt,
        modelUsed: model,
        providerUsed: "images-api",
        fallbackUsed: model !== modelChain[0],
        attempts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown try-on error";
      attempts.push({ provider: "images", model, error: message });
    }
  }

  throw new TryOnProviderError(
    attempts.length
      ? `All images API try-on models failed: ${attempts.map((attempt) => `${attempt.model}: ${attempt.error || "unknown"}`).join(" | ")}`
      : "Failed to generate try-on image with Images API"
    ,
    attempts
  );
}

type GeminiResponsePart = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string; mimeType?: string };
};

const extractGeminiImage = (payload: unknown) => {
  const response = payload as {
    candidates?: Array<{
      content?: { parts?: GeminiResponsePart[] };
    }>;
  };

  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
  const imagePart = parts.find((part) => Boolean(part.inlineData?.data || part.inline_data?.data));
  const imageData = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const mimeType = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || imagePart?.inline_data?.mimeType || "image/png";

  if (!imageData) {
    throw new Error("Gemini API did not return an image");
  }

  return { imageData, mimeType };
};

async function generateWithGeminiApi(
  prompt: string,
  userImage: ResolvedImageSource,
  lookImage: ResolvedImageSource,
  modelChain: string[]
): Promise<TryOnGenerationResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const attempts: TryOnAttempt[] = [];

  for (const model of modelChain) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: userImage.mimeType,
                    data: userImage.bytes.toString("base64"),
                  },
                },
                {
                  inline_data: {
                    mime_type: lookImage.mimeType,
                    data: lookImage.bytes.toString("base64"),
                  },
                },
                { text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`Gemini API returned ${response.status}${message ? `: ${message}` : ""}`);
      }

      const payload = (await response.json()) as unknown;
      const { imageData, mimeType } = extractGeminiImage(payload);

      return {
        imageDataUrl: `data:${mimeType};base64,${imageData}`,
        prompt,
        modelUsed: model,
        providerUsed: "gemini-api",
        fallbackUsed: model !== modelChain[0],
        attempts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Gemini try-on error";
      attempts.push({ provider: "gemini", model, error: message });
    }
  }

  throw new TryOnProviderError(
    attempts.length
      ? `All Gemini try-on models failed: ${attempts.map((attempt) => `${attempt.model}: ${attempt.error || "unknown"}`).join(" | ")}`
      : "Failed to generate try-on image with Gemini",
    attempts
  );
}

export async function generateTryOnImage(
  input: TryOnGenerationInput,
  requestUrl: string
): Promise<TryOnGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });
  const prompt = buildPrompt(input);
  const userImage = await resolveUrlToBytes(input.userPhotoUrl, requestUrl);
  const lookImage = await resolveUrlToBytes(input.lookImageUrl, requestUrl);
  const modelChain = getTryOnModelChain();
  const geminiModelChain = getGeminiModelChain();
  const providerChain = getTryOnProviderChain();
  const attempts: TryOnAttempt[] = [];

  for (const provider of providerChain) {
    try {
      if (provider === "responses") {
        const result = await generateWithResponsesApi(openai, input, prompt, userImage, lookImage, modelChain);
        return {
          ...result,
          attempts: [...attempts, ...result.attempts],
        };
      }

      if (provider === "images") {
        const result = await generateWithImagesApi(openai, prompt, userImage, lookImage, modelChain);
        return {
          ...result,
          attempts: [...attempts, ...result.attempts],
        };
      }

      if (provider === "gemini") {
        const result = await generateWithGeminiApi(prompt, userImage, lookImage, geminiModelChain);
        return {
          ...result,
          attempts: [...attempts, ...result.attempts],
        };
      }

      attempts.push({
        provider,
        model: provider,
        error: "Unknown try-on provider",
      });
    } catch (error) {
      if (error instanceof TryOnProviderError) {
        attempts.push(...error.attempts);
        continue;
      }

      attempts.push({
        provider,
        model: provider,
        error: error instanceof Error ? error.message : "Unknown try-on provider error",
      });
    }
  }

  throw new Error(
    attempts.length
      ? `All try-on providers failed: ${attempts.map((attempt) => `${attempt.provider}/${attempt.model}: ${attempt.error || "unknown"}`).join(" | ")}`
      : "Failed to generate try-on image"
  );
}

export function buildTryOnPromptPreview(input: TryOnGenerationInput) {
  return normalizeText(buildPrompt(input));
}
