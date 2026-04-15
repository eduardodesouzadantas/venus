import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { resolveAgencySession } from "@/lib/agency";
import {
  RESOURCE_CONTROL_FIELD_DEFINITIONS,
  updateAgencyResourceControlLimits,
} from "@/lib/agency/resource-control";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orgId: string;
  }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRedirect(value: FormDataEntryValue | null, fallback: string) {
  const raw = normalize(value);
  if (!raw.startsWith("/agency")) {
    return fallback;
  }

  return raw;
}

function parsePositiveLimit(value: FormDataEntryValue | null, fieldName: string) {
  const raw = normalize(value);
  if (!raw) {
    throw new Error(`Missing ${fieldName}`);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return Math.trunc(parsed);
}

function parseOptionalLimit(value: FormDataEntryValue | null) {
  const raw = normalize(value);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid override limit");
  }

  return Math.trunc(parsed);
}

function buildRedirectUrl(requestUrl: string, redirectTo: string, params: Record<string, string>) {
  const url = new URL(redirectTo, requestUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function handleMutation(request: NextRequest, context: RouteContext) {
  try {
    const session = await resolveAgencySession();
    const { orgId } = await context.params;

    const editingEnabled = process.env.AGENCY_RESOURCE_CONTROL_EDITING_ENABLED !== "false";
    if (!editingEnabled) {
      return NextResponse.json({ error: "Editing disabled" }, { status: 403 });
    }

    const formData = await request.formData();
    const redirectTo = readRedirect(formData.get("redirect_to"), `/agency/resource-control?orgId=${encodeURIComponent(orgId)}`);
    const reason = normalize(formData.get("reason"));

    const resources = RESOURCE_CONTROL_FIELD_DEFINITIONS.map((definition) => ({
      resourceType: definition.resourceType,
      monthlyLimit: parsePositiveLimit(formData.get(definition.monthlyFieldName), definition.monthlyFieldName),
      overrideLimit: parseOptionalLimit(formData.get(definition.overrideFieldName)),
    }));

    if (!reason) {
      throw new Error("Missing reason");
    }

    await updateAgencyResourceControlLimits({
      orgId,
      actorUserId: session.user.id,
      reason,
      resources,
    });

    revalidatePath("/agency/resource-control");
    revalidatePath(`/agency/resource-control?orgId=${orgId}`);
    revalidatePath("/agency/merchants");
    revalidatePath(`/agency/orgs/${orgId}`);
    revalidatePath("/agency/billing");

    return NextResponse.redirect(buildRedirectUrl(request.url, redirectTo, { orgId, saved: "1" }), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resource limit update failed";
    if (message === "Agency access denied") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    const orgId = (await context.params).orgId;
    const redirectTo = `/agency/resource-control?orgId=${encodeURIComponent(orgId)}&error=${encodeURIComponent(message)}`;
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleMutation(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleMutation(request, context);
}
