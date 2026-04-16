import { generateTryOnImage } from "@/lib/tryon/ai-tryon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body as {
    userPhotoUrl?: string;
    lookImageUrl?: string;
    lookName?: string;
    brandName?: string;
    appName?: string;
    styleDirection?: string;
    imageGoal?: string;
    essenceLabel?: string;
    essenceSummary?: string;
    profileSignal?: string;
    lookDescription?: string;
    benefitLine?: string;
  };

  console.info("[try-on/generate] request start", {
    hasUserPhoto: Boolean(input.userPhotoUrl),
    hasLookImage: Boolean(input.lookImageUrl),
    hasLookName: Boolean(input.lookName),
  });

  if (!input.userPhotoUrl || !input.lookImageUrl || !input.lookName) {
    console.warn("[try-on/generate] missing required fields", {
      hasUserPhoto: Boolean(input.userPhotoUrl),
      hasLookImage: Boolean(input.lookImageUrl),
      hasLookName: Boolean(input.lookName),
    });
    return Response.json(
      { error: "Missing userPhotoUrl, lookImageUrl or lookName" },
      { status: 400 }
    );
  }

  try {
    const result = await generateTryOnImage(
      {
        userPhotoUrl: input.userPhotoUrl,
        lookImageUrl: input.lookImageUrl,
        lookName: input.lookName,
        brandName: input.brandName,
        appName: input.appName,
        styleDirection: input.styleDirection,
        imageGoal: input.imageGoal,
        essenceLabel: input.essenceLabel,
        essenceSummary: input.essenceSummary,
        profileSignal: input.profileSignal,
        lookDescription: input.lookDescription,
        benefitLine: input.benefitLine,
      },
      request.url
    );

    console.info("[try-on/generate] request completed", {
      providerUsed: result.providerUsed || null,
      modelUsed: result.modelUsed || null,
      fallbackUsed: result.fallbackUsed ?? null,
      hasImageData: Boolean(result.imageDataUrl),
    });

    return Response.json(
      {
        imageDataUrl: result.imageDataUrl,
        prompt: result.prompt,
        modelUsed: result.modelUsed,
        providerUsed: result.providerUsed,
        fallbackUsed: result.fallbackUsed,
        attempts: result.attempts,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate try-on image";
    console.warn("[try-on/generate] request failed", {
      error: message,
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
