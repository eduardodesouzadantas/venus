import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value: FormDataEntryValue | null, fallback: string) {
  const raw = normalize(value);
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const access = await resolveMerchantOrgAccess(slug);
    const formData = await request.formData();
    const suggestionKey = normalize(formData.get("suggestion_key"));
    const suggestionType = normalize(formData.get("suggestion_type"));
    const suggestionTitle = normalize(formData.get("suggestion_title"));
    const redirectTo = normalizePath(formData.get("redirect_to"), `/org/${slug}/suggestions`);

    if (!suggestionKey || !suggestionTitle) {
      return NextResponse.json({ error: "Missing suggestion payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("tenant_events").insert({
      org_id: access.org.id,
      actor_user_id: access.user.id,
      event_type: "merchant.suggestion_completed",
      event_source: "merchant",
      dedupe_key: `merchant:suggestion:${access.org.id}:${suggestionKey}:${Date.now()}`,
      payload: {
        org_slug: access.org.slug,
        suggestion_key: suggestionKey,
        suggestion_type: suggestionType || null,
        suggestion_title: suggestionTitle,
        completed_at: new Date().toISOString(),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath(`/org/${slug}/suggestions`);
    revalidatePath(`/org/${slug}/dashboard`);

    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete suggestion";
    const status = message === "Unauthorized" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
