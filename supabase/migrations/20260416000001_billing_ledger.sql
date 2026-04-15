-- Billing operational ledger for Venus Engine
-- Apply after billing_stripe.sql

CREATE TABLE IF NOT EXISTS public.billing_payment_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'stripe',
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  stripe_price_id TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_events_org_id ON public.billing_payment_events (org_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_events_stripe_event_id ON public.billing_payment_events (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_events_created_at ON public.billing_payment_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payment_events_stripe_subscription_id ON public.billing_payment_events (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  amount_paid_cents BIGINT NOT NULL DEFAULT 0,
  amount_due_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'draft',
  billing_period_from DATE NOT NULL,
  billing_period_to DATE NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_id ON public.billing_invoices (org_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_stripe_invoice_id ON public.billing_invoices (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices (status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date ON public.billing_invoices (due_date);

ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ;
ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS grace_period_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS payment_retry_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS last_payment_error TEXT;

CREATE OR REPLACE FUNCTION public.resolve_billing_grace_period()
RETURNS INTERVAL
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(LEFT(COALESCE(current_setting('BILLING_GRACE_PERIOD_DAYS', ''), ''), '')::INT,
    7
  ) * INTERVAL '1 day';
$$;

CREATE OR REPLACE FUNCTION public.is_org_in_grace_period(org_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  grace_until TIMESTAMPTZ;
BEGIN
  SELECT grace_period_until INTO grace_until
  FROM public.billing_subscriptions
  WHERE org_id = $1 AND grace_period_enabled = TRUE;

  IF NOT FOUND OR grace_until IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN NOW() < grace_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.should_kill_switch_org_for_billing(org_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sub_record RECORD;
  billing_status TEXT;
  in_grace BOOLEAN;
BEGIN
  SELECT 
    bs.billing_status,
    bs.grace_period_enabled,
    bs.grace_period_until,
    bs.stripe_current_period_end
  INTO sub_record
  FROM public.billing_subscriptions bs
  WHERE bs.org_id = $1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  billing_status := sub_record.billing_status;
  in_grace := public.is_org_in_grace_period($1);

  IF billing_status IN ('past_due', 'unpaid') AND NOT in_grace THEN
    RETURN TRUE;
  END IF;

  IF billing_status = 'canceled' AND sub_record.stripe_current_period_end IS NOT NULL THEN
    IF NOW() >= sub_record.stripe_current_period_end THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT SELECT ON public.billing_payment_events TO authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_billing_grace_period() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_in_grace_period(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.should_kill_switch_org_for_billing(TEXT) TO authenticated;