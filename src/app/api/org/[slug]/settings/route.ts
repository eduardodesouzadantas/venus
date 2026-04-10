import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMerchantOrgAccess } from "@/lib/merchant/access";
import {
  buildMerchantSettingsPayload,
  fileToDataUrl,
  normalizePrimaryColor,
  normalizeStoreName,
  normalizeWhatsAppNumber,
} from "@/lib/merchant/settings";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function readOrgOrThrow(slug: string) {
  const access = await resolveMerchantOrgAccess(slug);
  return access;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const access = await readOrgOrThrow(slug);

    return NextResponse.json(
      {
        ok: true,
        org: {
          id: access.org.id,
          slug: access.org.slug,
          name: access.org.name,
          logo_url: access.org.logo_url || null,
          primary_color: access.org.primary_color || "#D4AF37",
          whatsapp_number: access.org.whatsapp_number || "",
          plan_id: access.org.plan_id || null,
          status: access.org.status,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load settings" },
      { status: 403 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  let access;
  try {
    access = await readOrgOrThrow(slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 403 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const currentName = access.org.name;
  const currentPrimaryColor = access.org.primary_color || "#D4AF37";
  const currentWhatsAppNumber = access.org.whatsapp_number || "";

  const nextName = normalize(formData.get("name")) || currentName;
  const nextPrimaryColor = normalizePrimaryColor(normalize(formData.get("primary_color")) || currentPrimaryColor);
  const nextWhatsAppNumber = normalizeWhatsAppNumber(normalize(formData.get("whatsapp_number")) || currentWhatsAppNumber);
  const clearLogo = normalize(formData.get("clear_logo")) === "1";
  const logoEntry = formData.get("logo_file");

  let logoUrl = access.org.logo_url || null;
  if (logoEntry instanceof File && logoEntry.size > 0) {
    logoUrl = await fileToDataUrl(logoEntry);
  } else if (clearLogo) {
    logoUrl = null;
  }

  const admin = createAdminClient();
  const payload = buildMerchantSettingsPayload({
    name: normalizeStoreName(nextName),
    logo_url: logoUrl,
    primary_color: nextPrimaryColor,
    whatsapp_number: nextWhatsAppNumber,
  });

  const { data, error } = await admin
    .from("orgs")
    .update({
      name: payload.name,
      logo_url: payload.logo_url,
      primary_color: payload.primary_color,
      whatsapp_number: payload.whatsapp_number,
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.org.id)
    .select("id, slug, name, logo_url, primary_color, whatsapp_number, plan_id, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      org: {
        id: data.id,
        slug: data.slug,
        name: data.name,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color || "#D4AF37",
        whatsapp_number: data.whatsapp_number || "",
        plan_id: data.plan_id || null,
        status: data.status,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
