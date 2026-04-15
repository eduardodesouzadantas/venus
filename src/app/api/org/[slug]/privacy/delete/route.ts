import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import { buildTenantPrivacyDeleteSummary, purgeTenantData, recordPrivacyAuditEvent } from "@/lib/privacy/tenant-data";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isConfirmed(value: unknown) {
  if (value === true) return true;
  if (typeof value === "string") {
    return ["true", "yes", "confirm"].includes(value.trim().toLowerCase());
  }
  return false;
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) as Record<string, unknown> | null;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return null;
  }

  return {
    confirm: formData.get("confirm"),
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await resolveMerchantOrgAccess(slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 403 }
    );
  }

  const body = await readBody(request);
  const confirmed = isConfirmed(body?.confirm ?? body?.confirmed ?? body?.delete);

  if (!confirmed) {
    return NextResponse.json(
      { error: "Confirmation required", hint: "Set confirm=true to delete tenant data" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const orgId = access.org.id;
  const orgSlug = access.org.slug;

  await recordPrivacyAuditEvent(admin, {
    orgId,
    orgSlug,
    actorUserId: access.user.id,
    action: "tenant_delete_requested",
    summary: `Tenant deletion requested for ${orgSlug}`,
    details: {
      source: access.source,
    },
  });

  try {
    const deleted = await purgeTenantData(admin, {
      orgId,
      orgSlug,
    });

    const summary = buildTenantPrivacyDeleteSummary({
      organization: access.org,
      deleted,
    });

    await recordPrivacyAuditEvent(admin, {
      orgId,
      orgSlug,
      actorUserId: access.user.id,
      action: "tenant_delete_completed",
      summary: `Tenant deletion completed for ${orgSlug}`,
      details: {
        removed_at: summary.removed_at,
        organization: summary.organization,
        deleted: summary.deleted,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        deleted: summary,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    await recordPrivacyAuditEvent(admin, {
      orgId,
      orgSlug,
      actorUserId: access.user.id,
      action: "tenant_delete_failed",
      summary: `Tenant deletion failed for ${orgSlug}`,
      details: {
        error: normalize(error instanceof Error ? error.message : error),
      },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete tenant data",
      },
      { status: 500 }
    );
  }
}
