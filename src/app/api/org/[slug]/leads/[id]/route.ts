import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, normalizeTenantSlug } from "@/lib/tenant/core";
import { isLeadStatus, type LeadStatus } from "@/lib/leads";

export const dynamic = "force-dynamic";

function normalizeReturnTo(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : fallback;
}

function buildActionErrorRedirect(request: Request, fallbackPath: string, message: string) {
  const target = new URL(normalizeReturnTo(fallbackPath, "/"), request.url);
  target.searchParams.set("action_error", message);
  return NextResponse.redirect(target, { status: 303 });
}

async function readLeadMutationBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return {
      body: (await request.json().catch(() => null)) as Record<string, unknown> | null,
      isForm: false,
      returnTo: null as string | null,
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { body: null as Record<string, unknown> | null, isForm: true, returnTo: null as string | null };
  }

  const body: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    body[key] = typeof value === "string" ? value : null;
  }

  return {
    body,
    isForm: true,
    returnTo: typeof body.return_to === "string" ? body.return_to : typeof body.redirect_to === "string" ? body.redirect_to : null,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) {
    return NextResponse.json({ error: "Invalid org slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { org, error: orgError } = await fetchTenantBySlug(supabase, normalizedSlug);
  if (orgError || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: timeline, error: timelineError } = await supabase
    .from("lead_timeline")
    .select("*")
    .eq("lead_id", id)
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (timelineError) {
    console.warn("[CRM] failed to load timeline", { leadId: id, error: timelineError.message });
  }

  return NextResponse.json({
    lead,
    timeline: timeline || [],
  });
}

async function handleLeadMutation(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const normalizedSlug = normalizeTenantSlug(slug);
  if (!normalizedSlug) {
    return NextResponse.json({ error: "Invalid org slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { org, error: orgError } = await fetchTenantBySlug(supabase, normalizedSlug);
  if (orgError || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: existingLead, error: existingError } = await supabase
    .from("leads")
    .select("id, status, notes, owner_user_id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (existingError || !existingLead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { body, isForm, returnTo } = await readLeadMutationBody(request);
  if (!body) {
    return isForm
      ? buildActionErrorRedirect(request, returnTo || `/org/${slug}/dashboard`, "Invalid body")
      : NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const timelineEvents: Array<{ event_type: string; event_data: Record<string, unknown> }> = [];

  if (body.status && isLeadStatus(body.status)) {
    const newStatus = body.status as LeadStatus;
    if (newStatus !== existingLead.status) {
      updates.status = newStatus;
      updates.last_interaction_at = new Date().toISOString();
      timelineEvents.push({
        event_type: "status_changed",
        event_data: { previous: existingLead.status, current: newStatus },
      });
    }
  }

  if (body.notes !== undefined) {
    const newNotes = typeof body.notes === "string" ? body.notes : null;
    if (newNotes !== existingLead.notes) {
      updates.notes = newNotes;
      if (newNotes && !existingLead.notes) {
        timelineEvents.push({
          event_type: "note_added",
          event_data: { has_notes: true },
        });
      }
    }
  }

  if (body.owner_user_id !== undefined) {
    const newOwner = typeof body.owner_user_id === "string" ? body.owner_user_id : null;
    if (newOwner !== existingLead.owner_user_id) {
      updates.owner_user_id = newOwner;
      timelineEvents.push({
        event_type: "assigned",
        event_data: { owner_user_id: newOwner },
      });
    }
  }

  if (body.next_follow_up_at !== undefined) {
    const nextFollowUp = body.next_follow_up_at
      ? new Date(body.next_follow_up_at as string).toISOString()
      : null;
    updates.next_follow_up_at = nextFollowUp;
    if (nextFollowUp) {
      timelineEvents.push({
        event_type: "follow_up_scheduled",
        event_data: { next_follow_up_at: nextFollowUp },
      });
    }
  }

  if (Object.keys(updates).length === 0) {
    return isForm
      ? NextResponse.redirect(new URL(normalizeReturnTo(returnTo, `/org/${slug}/dashboard`), request.url), { status: 303 })
      : NextResponse.json({ lead: existingLead });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updatedLead, error: updateError } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("org_id", org.id)
    .select()
    .single();

  if (updateError) {
    return isForm
      ? buildActionErrorRedirect(request, returnTo || `/org/${slug}/dashboard`, updateError.message)
      : NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (timelineEvents.length > 0) {
    for (const event of timelineEvents) {
      await supabase.from("lead_timeline").insert({
        lead_id: id,
        org_id: org.id,
        actor_user_id: user.id,
        event_type: event.event_type,
        event_data: event.event_data,
      });
    }
  }

  return isForm
    ? NextResponse.redirect(new URL(normalizeReturnTo(returnTo, `/org/${slug}/dashboard`), request.url), { status: 303 })
    : NextResponse.json({ lead: updatedLead });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> }
) {
  return handleLeadMutation(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> }
) {
  return handleLeadMutation(request, context);
}
