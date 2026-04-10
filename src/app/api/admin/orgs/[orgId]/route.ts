import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveAgencySession, updateAgencyOrgState } from "@/lib/agency";

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
