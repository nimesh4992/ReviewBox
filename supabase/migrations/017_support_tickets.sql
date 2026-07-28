-- ============================================================
-- 017 — Support tickets (admin business portal)
-- ============================================================
-- One row per support request + a message thread per ticket.
-- Managed at /admin/tickets; customers file tickets in-app via
-- POST /api/support/tickets (Settings → Contact support).
--
-- All writes go through service-role API routes. RLS grants
-- customers read-only access to their own workspace's tickets
-- (minus internal notes) so a future in-app ticket-history view
-- needs no schema change.
--
-- Idempotent — safe to run twice (D006).
-- ============================================================

create table if not exists public.support_tickets (
  id                 uuid primary key default uuid_generate_v4(),
  -- Nullable: email tickets may precede a known workspace, and deleting a
  -- workspace must not destroy support history.
  workspace_id       uuid references public.workspaces(id) on delete set null,
  requester_clerk_id text,
  requester_email    text not null,
  requester_name     text,
  subject            text not null,
  status             text not null default 'open'
                     check (status in ('open', 'pending', 'resolved', 'closed')),
  priority           text not null default 'normal'
                     check (priority in ('urgent', 'high', 'normal', 'low')),
  source             text not null default 'manual'
                     check (source in ('in_app', 'email', 'manual')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_message_at    timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id          uuid primary key default uuid_generate_v4(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('customer', 'admin')),
  author_name text,
  body        text not null,
  -- Admin-only note; excluded from the customer-facing SELECT policy below.
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists support_tickets_status_idx
  on public.support_tickets(status, last_message_at desc);
create index if not exists support_tickets_workspace_idx
  on public.support_tickets(workspace_id);
create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_tickets         enable row level security;
alter table public.support_ticket_messages enable row level security;

-- Customers may read their own workspace's tickets…
drop policy if exists "rls_support_tickets_select" on public.support_tickets;
create policy "rls_support_tickets_select" on public.support_tickets
  for select using (workspace_id in (select public.my_workspace_ids()));

-- …and the non-internal messages on them.
drop policy if exists "rls_support_ticket_messages_select" on public.support_ticket_messages;
create policy "rls_support_ticket_messages_select" on public.support_ticket_messages
  for select using (
    not is_internal
    and ticket_id in (
      select id from public.support_tickets
      where workspace_id in (select public.my_workspace_ids())
    )
  );

-- No insert/update/delete policies: mutations are service-role only
-- (/api/support/tickets, /api/admin/tickets/*).

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();
