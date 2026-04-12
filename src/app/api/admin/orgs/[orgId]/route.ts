import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveAgencySession, updateAgencyOrgState } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orgId: string;
  }>;
};

type OrgAction = "activate" | "suspend" | "toggle_kill_switch" | "soft_delete";

function readAction(value: FormDataEntryValue | null): OrgAction | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "activate" || raw === "suspend" || raw === "toggle_kill_switch" || raw === "soft_delete") {
    return raw;
  }
  return null;
}

function readRedirect(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/agency")) return "/agency";
  return raw;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await resolveAgencySession();
    const body = (await request.json()) as { commission_active?: boolean; commission_rate?: number };
    const admin = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (typeof body.commission_active === "boolean") updates.commission_active = body.commission_active;
    if (typeof body.commission_rate === "number") updates.commission_rate = body.commission_rate;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    const { error } = await admin.from("orgs").update(updates).eq("id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath(`/agency/orgs/${orgId}`);
    revalidatePath(`/agency/merchants/${orgId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const agencySession = await resolveAgencySession();

    const formData = await request.formData();
    const action = readAction(formData.get("action"));

    if (!action) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await updateAgencyOrgState(orgId, action, agencySession.user.id);
    revalidatePath("/agency");
    revalidatePath("/agency/billing");
    revalidatePath(`/agency/orgs/${orgId}`);
    revalidatePath(`/agency/merchants/${orgId}`);

    return NextResponse.redirect(new URL(readRedirect(formData.get("redirect_to")), request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agency action failed";
    const status = message === "Agency access denied" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
