import { syncLeadContext } from "@/lib/lead-context/client";

export type OnboardingConversionEventType =
  | "first_message_shown"
  | "photo_sent"
  | "photo_not_sent"
  | "wow_shown"
  | "post_wow_cta_clicked";

export type OnboardingConversionEventInput = {
  orgId?: string | null;
  leadId?: string | null;
  savedResultId?: string | null;
  phone?: string | null;
  email?: string | null;
  eventType: OnboardingConversionEventType;
  action?: string | null;
  outcome?: string | null;
  lastAction?: string | null;
  lastActionOutcome?: string | null;
  lastActivityAt?: string | null;
  eventMeta?: Record<string, unknown> | null;
};

const EVENT_ACTIONS: Record<OnboardingConversionEventType, { action: string; outcome: string }> = {
  first_message_shown: { action: "SHOW_ONBOARDING_WELCOME", outcome: "FIRST_MESSAGE_SHOWN" },
  photo_sent: { action: "UPLOAD_PHOTO", outcome: "PHOTO_SENT" },
  photo_not_sent: { action: "SKIP_PHOTO", outcome: "PHOTO_NOT_SENT" },
  wow_shown: { action: "SHOW_WOW", outcome: "WOW_SHOWN" },
  post_wow_cta_clicked: { action: "CLICK_POST_WOW_CTA", outcome: "POST_WOW_CTA_CLICKED" },
};

export async function trackOnboardingConversionEvent(input: OnboardingConversionEventInput) {
  if (!input.orgId) {
    return null;
  }

  const mapping = EVENT_ACTIONS[input.eventType];

  return syncLeadContext({
    orgId: input.orgId,
    leadId: input.leadId || null,
    savedResultId: input.savedResultId || null,
    phone: input.phone || null,
    email: input.email || null,
    eventType: input.eventType,
    action: input.action || mapping.action,
    outcome: input.outcome || mapping.outcome,
    lastAction: input.lastAction || mapping.action,
    lastActionOutcome: input.lastActionOutcome || mapping.outcome,
    lastActivityAt: input.lastActivityAt || null,
    eventMeta: {
      surface: "onboarding_wow",
      event_type: input.eventType,
      ...(input.eventMeta || {}),
    },
  });
}

