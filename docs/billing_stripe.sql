-- Stripe billing persistence for org-level subscriptions.
-- Apply after the core orgs table exists.

create table if not exists public.billing_subscriptions (
  org_id text primary key references public.orgs(id) on delete cascade,
  billing_provider text not null default 'stripe',
  billing_status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  stripe_price_id text,
  stripe_cancel_at_period_end boolean not null default false,
  stripe_current_period_end timestamptz null,
  stripe_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (billing_status);

create index if not exists billing_subscriptions_provider_idx
  on public.billing_subscriptions (billing_provider);
