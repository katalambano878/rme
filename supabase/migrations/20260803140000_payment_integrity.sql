-- Payment integrity: unique refs, callback event log, SMS attempt log.
-- Safe for production: additive + indexes; no data deletion.

-- Unique provider_ref when present (idempotent gateway references)
create unique index if not exists payments_provider_ref_unique
  on public.payments (provider_ref)
  where provider_ref is not null and provider_ref <> '';

-- One pending/paid row per order+provider is preferred; soft uniqueness for paid
create unique index if not exists payments_order_provider_paid_unique
  on public.payments (order_id, provider)
  where status = 'paid';

create table if not exists public.callback_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  event_type text not null,
  external_event_id text,
  reference text,
  payload_hash text,
  signature_status text not null default 'unknown',
  processing_status text not null default 'received',
  attempts integer not null default 0,
  error_message text,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists callback_events_gateway_external_unique
  on public.callback_events (gateway, external_event_id)
  where external_event_id is not null;

create index if not exists callback_events_reference_idx
  on public.callback_events (reference);

create table if not exists public.sms_attempts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'moolre',
  recipient text not null,
  message_type text not null,
  template_name text,
  related_user_id uuid,
  related_order_id uuid references public.orders (id) on delete set null,
  related_payment_id uuid references public.payments (id) on delete set null,
  provider_message_id text,
  status text not null default 'pending',
  attempts integer not null default 0,
  failure_reason text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sms_attempts_order_type_idx
  on public.sms_attempts (related_order_id, message_type);

create index if not exists orders_order_number_idx
  on public.orders (order_number);

create index if not exists payments_status_created_idx
  on public.payments (status, created_at desc);
