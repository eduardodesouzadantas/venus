import { NextResponse } from "next/server";
import { runAutoLimitsJob, getOptimizationRecommendations } from "@/lib/optimization/auto-limits";

export const dynamic = "force-dynamic";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAuthorized(request: Request) {
  const secret = normalize(process.env.AUTO_OPTIMIZATION_SECRET);
  if (!secret) return false;

  const provided = normalize(request.headers.get("x-venus-optimization-secret"));
  return provided.length > 0 && provided === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true" || url.searchParams.get("dryRun") === "true";

  try {
    const result = await runAutoLimitsJob(dryRun);

    return NextResponse.json({
      success: true,
      job_id: result.job_id,
      started_at: result.started_at,
      completed_at: result.completed_at,
      tenants_processed: result.tenants_processed,
      adjustments_applied: result.adjustments_applied,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[OPTIMIZATION_API] Job failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Job execution failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("org_id");
  const recommendations = url.searchParams.get("recommendations") === "true";

  if (recommendations && orgId) {
    const result = await getOptimizationRecommendations(orgId);
    return NextResponse.json(result);
  }

  return NextResponse.json(
    {
      message: "Auto Limits Optimization API",
      endpoints: {
        POST: { description: "Run auto-limits job", queryParams: { dry_run: "boolean" } },
        GET: { description: "Get recommendations", queryParams: { org_id: "string", recommendations: "boolean" } },
      },
    },
    { status: 200 }
  );
}