-- ============================================================
-- 004 — Webhook event dedup
-- ============================================================
-- Stripe retries events on any non-2xx response and may deliver
-- duplicates during recovery. Without dedup we'd double-process
-- plan changes, send duplicate emails, double-write audit logs.
--
-- Pattern: insert the event ID first (unique constraint). If the
-- insert fails with code 23505 (unique violation), it's a duplicate
-- and we ack 200 without processing again.
-- ============================================================

create table public.webhook_events (
  id          text primary key,                    -- Stripe event ID (evt_*)
  source      text not null default 'stripe'
              check (source in ('stripe', 'google_play', 'app_store', 'clerk')),
  type        text not null,                       -- e.g. 'checkout.session.completed'
  received_at timestamptz not null default now()
);

create index webhook_events_source_idx on public.webhook_events(source, received_at desc);

-- No RLS — service-role only writes; nothing in the client should ever
-- read this table.
