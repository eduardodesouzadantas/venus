import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveAgencySession, updateAgencyOrgState } from "@/lib/agency";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    orgId: string;
  }>;
};

type OrgAction = "activate" | "suspend" | "toggle_kill_switch";

function readAction(value: FormDataEntryValue | null): OrgAction | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "activate" || raw === "suspend" || raw === "toggle_kill_switch") {
    return raw;
  }
  return null;
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

    return NextResponse.redirect(new URL("/agency", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agency action failed";
    const status = message === "Agency access denied" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
