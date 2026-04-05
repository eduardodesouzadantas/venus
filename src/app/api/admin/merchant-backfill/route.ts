import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backfillMerchantAuthUsers } from "@/lib/auth/merchant-backfill";

export const dynamic = "force-dynamic";

type RequestBody = {
  dry_run?: boolean;
  default_org_slug?: string;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAuthorized(request: Request) {
  const secret = normalize(process.env.WHATSAPP_BACKFILL_SECRET);
  if (!secret) return false;

  const provided = normalize(request.headers.get("x-venus-backfill-secret"));
  return provided.length > 0 && provided === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json(
      { error: "Supabase service role unavailable", details: String(error) },
      { status: 503 }
    );
  }

  try {
    const report = await backfillMerchantAuthUsers(admin, {
      dryRun: body.dry_run ?? true,
      defaultOrgSlug: body.default_org_slug || "maison-elite",
    });

    return NextResponse.json(
      {
        ok: true,
        dry_run: body.dry_run ?? true,
        default_org_slug: body.default_org_slug || "maison-elite",
        report,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Merchant backfill failed",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
