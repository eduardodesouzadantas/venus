import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET() {
  return NextResponse.json({
    commitSha: safeString(process.env.VERCEL_GIT_COMMIT_SHA),
    commitRef: safeString(process.env.VERCEL_GIT_COMMIT_REF),
    deploymentId: safeString(process.env.VERCEL_DEPLOYMENT_ID),
    deploymentUrl: safeString(process.env.VERCEL_URL),
    environment: safeString(process.env.VERCEL_ENV) || safeString(process.env.NODE_ENV),
    buildTimestamp: new Date().toISOString(),
  });
}
