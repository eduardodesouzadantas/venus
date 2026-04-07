import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertMerchantWritableOrgAccess } from "@/lib/tenant/core";
import {
  encryptMetaToken,
  loadMetaIntegrationByOrgId,
  validateMetaWhatsAppConnection,
} from "@/lib/whatsapp/meta";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveMerchantOrg(slug: string) {
  const supabase = await createClient();
  const resolved = await assertMerchantWritableOrgAccess(supabase);

  if (resolved.org.slug !== slug) {
    throw new Error("Merchant org mismatch");
  }

  return resolved;
}

function buildWebhookUrl(request: Request) {
  const origin = new URL(request.url).origin;
  return `${origin}/api/meta/whatsapp/webhook`;
}

function sanitizeIntegration(record: Awaited<ReturnType<typeof loadMetaIntegrationByOrgId>>) {
  if (!record) return null;

  return {
    org_id: record.org_id,
    phone_number_id: record.phone_number_id,
    business_account_id: record.business_account_id,
    display_phone_number: record.display_phone_number,
    verified_name: record.verified_name,
    quality_rating: record.quality_rating,
    connected_at: record.connected_at,
    last_verified_at: record.last_verified_at,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  let resolved;
  try {
    resolved = await resolveMerchantOrg(slug);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const org = resolved.org;
  const integration = await loadMetaIntegrationByOrgId(supabase, org.id).catch((error: unknown) => {
    console.warn("[META_CONNECT] failed to load integration", error);
    return null;
  });

  return NextResponse.json(
    {
      ok: true,
      org_slug: org.slug,
      org_name: org.name,
      connected: Boolean(integration),
      integration: sanitizeIntegration(integration),
      webhook_url: buildWebhookUrl(_request),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        access_token?: string;
        business_account_id?: string;
        phone_number_id?: string;
      }
    | null;

  const accessToken = normalize(body?.access_token);
  const businessAccountId = normalize(body?.business_account_id);
  const phoneNumberId = normalize(body?.phone_number_id);

  if (!accessToken || !businessAccountId || !phoneNumberId) {
    return NextResponse.json({ error: "Preencha access token, business account e phone number id" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await resolveMerchantOrg(slug);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado" }, { status: 403 });
  }

  const validation = await validateMetaWhatsAppConnection({
    accessToken,
    businessAccountId,
    phoneNumberId,
  }).catch((error: unknown) => {
    return { error: error instanceof Error ? error.message : "Meta validation failed" } as const;
  });

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: upsertError } = await admin.from("whatsapp_meta_integrations").upsert(
    {
      org_id: resolved.org.id,
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId,
      access_token_encrypted: encryptMetaToken(accessToken),
      display_phone_number: validation.displayPhoneNumber,
      verified_name: validation.verifiedName,
      quality_rating: validation.qualityRating,
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      connected: true,
      ok: true,
      org_slug: slug,
      webhook_url: buildWebhookUrl(request),
      integration: {
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
        display_phone_number: validation.displayPhoneNumber,
        verified_name: validation.verifiedName,
        quality_rating: validation.qualityRating,
        meta_user: validation.metaUserName,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let resolved;
  try {
    resolved = await resolveMerchantOrg(slug);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("whatsapp_meta_integrations").delete().eq("org_id", resolved.org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
