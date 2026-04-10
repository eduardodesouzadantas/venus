import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  let body: { ref_code?: string; new_user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { ref_code, new_user_id } = body;

  if (!ref_code) {
    return NextResponse.json({ error: "Missing ref_code" }, { status: 400 });
  }

  // Buscar evento de compartilhamento original
  const { data: shareEvent } = await supabase
    .from("share_events")
    .select("user_id, org_id")
    .eq("ref_code", ref_code)
    .maybeSingle<{ user_id: string | null; org_id: string }>();

  if (!shareEvent) {
    return NextResponse.json({ org: null });
  }

  // Registrar conversão se for um novo usuário diferente de quem postou
  if (new_user_id && new_user_id !== shareEvent.user_id) {
    await supabase.from("referral_conversions").insert({
      referrer_user_id: shareEvent.user_id,
      new_user_id,
      org_id: shareEvent.org_id,
      ref_code,
    });
  }

  const { data: org } = await supabase
    .from("orgs")
    .select("id, slug, name")
    .eq("id", shareEvent.org_id)
    .maybeSingle();

  return NextResponse.json({ org: org ?? null });
}
