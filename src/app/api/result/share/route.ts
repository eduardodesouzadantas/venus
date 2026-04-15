import { NextRequest, NextResponse } from "next/server";
import { resultSharedWithGamification } from "@/lib/gamification/integration";

export const dynamic = "force-dynamic";

type ResultShareBody = {
  orgId?: string;
  resultId?: string;
  customerKey?: string;
  customerLabel?: string;
  platform?: string;
  shareId?: string;
  caption?: string;
  lookName?: string;
};

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(req: NextRequest) {
  let body: ResultShareBody;

  try {
    body = (await req.json()) as ResultShareBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const orgId = normalize(body.orgId);
  const resultId = normalize(body.resultId);
  const customerKey = normalize(body.customerKey) || resultId;
  const customerLabel = normalize(body.customerLabel) || customerKey;
  const platform = normalize(body.platform) || "share_sheet";
  const shareId = normalize(body.shareId) || `${resultId}:${platform}`;

  if (!orgId || !resultId || !customerKey || !shareId) {
    return NextResponse.json({ error: "Missing orgId, resultId or shareId" }, { status: 400 });
  }

  const result = await resultSharedWithGamification(orgId, customerKey, customerLabel, shareId, {
    now: new Date(),
  });

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    granted: result.granted,
    blocked: result.blocked,
    duplicates: result.duplicates,
    skipped: result.skipped,
    skippedReason: result.skippedReason,
    eventKey: result.eventKey,
  });
}
