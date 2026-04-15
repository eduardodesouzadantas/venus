import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import { buildTenantPrivacyExportBundle, recordPrivacyAuditEvent } from "@/lib/privacy/tenant-data";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unauthorized";
}

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await resolveMerchantOrgAccess(slug);
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 403 });
  }

  const admin = createAdminClient();
  const orgId = access.org.id;
  const orgSlug = access.org.slug;

  const [
    leadsResult,
    productsResult,
    savedResultsResult,
    leadContextResult,
    conversationsResult,
    messagesResult,
    tryonEventsResult,
  ] = await Promise.all([
    admin
      .from("leads")
      .select("id, org_id, name, email, phone, source, status, saved_result_id, intent_score, whatsapp_key, next_follow_up_at, created_at, updated_at, last_interaction_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    admin
      .from("products")
      .select("id, org_id, name, category, primary_color, style, type, price_range, image_url, external_url, stock_qty, reserved_qty, stock_status, description, persuasive_description, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    admin
      .from("saved_results")
      .select("id, org_id, user_email, user_name, payload, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    admin
      .from("lead_context")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
    admin
      .from("whatsapp_conversations")
      .select("id, created_at, last_updated, status, priority, last_message, unread_count, user_phone, user_name, user_context, org_slug")
      .eq("org_slug", orgSlug)
      .order("last_updated", { ascending: false }),
    admin
      .from("whatsapp_messages")
      .select("id, conversation_id, org_slug, created_at, sender, text, type, metadata")
      .eq("org_slug", orgSlug)
      .order("created_at", { ascending: false }),
    admin
      .from("tryon_events")
      .select("id, org_id, product_id, user_id, fal_request_id, status, result_image_url, created_at, updated_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const queryErrors = [
    leadsResult.error,
    productsResult.error,
    savedResultsResult.error,
    leadContextResult.error,
    conversationsResult.error,
    messagesResult.error,
    tryonEventsResult.error,
  ].filter(Boolean);

  if (queryErrors.length > 0) {
    return NextResponse.json(
      {
        error: "Failed to build privacy export",
        details: queryErrors.map((error) => error?.message || "unknown"),
      },
      { status: 500 }
    );
  }

  const bundle = buildTenantPrivacyExportBundle({
    organization: {
      id: access.org.id,
      slug: access.org.slug,
      name: access.org.name,
      branch_name: access.org.branch_name || null,
      status: access.org.status,
      plan_id: access.org.plan_id || null,
    },
    leads: leadsResult.data || [],
    products: productsResult.data || [],
    savedResults: savedResultsResult.data || [],
    leadContext: leadContextResult.data || [],
    whatsappConversations: conversationsResult.data || [],
    whatsappMessages: messagesResult.data || [],
    tryonEvents: tryonEventsResult.data || [],
  });

  await recordPrivacyAuditEvent(admin, {
    orgId,
    orgSlug,
    actorUserId: access.user.id,
    action: "data_export_completed",
    summary: `Exported privacy bundle for ${orgSlug}`,
    details: {
      counts: bundle.counts,
      source: access.source,
    },
  });

  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
