import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY!,
});

export interface TryOnInput {
  model_image: string;
  garment_image: string;
}

export interface TryOnResult {
  images: Array<{ url: string; content_type: string }>;
}

export async function submitTryOn(input: TryOnInput): Promise<string> {
  const result = await fal.queue.submit("fal-ai/fashn/tryon/v1.6", {
    input,
  });
  return result.request_id;
}

export async function getTryOnStatus(requestId: string) {
  return await fal.queue.status("fal-ai/fashn/tryon/v1.6", {
    requestId,
    logs: false,
  });
}

export async function getTryOnResult(requestId: string): Promise<TryOnResult> {
  const result = await fal.queue.result("fal-ai/fashn/tryon/v1.6", {
    requestId,
  });
  return result.data as TryOnResult;
}
