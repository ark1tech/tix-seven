-- TixSeven initial schema
-- Run via: supabase db push  (or paste into Supabase SQL editor)

create extension if not exists "pgcrypto";

-- ─── Events ────────────────────────────────────────────────────────────────
create table events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        timestamptz not null,
  venue       text not null,
  capacity    integer not null check (capacity > 0),
  created_at  timestamptz not null default now()
);

-- ─── Tickets ───────────────────────────────────────────────────────────────
create type ticket_tier   as enum ('vip', 'ga');
create type ticket_status as enum ('unused', 'used');

create table tickets (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events(id) on delete cascade,
  uin_hash           text not null,
  tier               ticket_tier   not null,
  seat               text not null,
  status             ticket_status not null default 'unused',
  purchase_timestamp timestamptz   not null default now(),
  created_at         timestamptz   not null default now(),

  -- One ticket per identity per event
  unique (event_id, uin_hash)
);

create index tickets_event_id_idx on tickets(event_id);
create index tickets_uin_hash_idx on tickets(uin_hash);

-- ─── Gates ─────────────────────────────────────────────────────────────────
create table gates (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references events(id) on delete set null,
  name       text not null,
  device_id  text not null unique,
  created_at timestamptz not null default now()
);

create index gates_event_id_idx on gates(event_id);

-- ─── Entry Logs ────────────────────────────────────────────────────────────
create type scan_result   as enum ('grant', 'deny');
create type denial_reason as enum ('invalid_id', 'no_ticket', 'already_used', 'wrong_event');

create table entry_logs (
  id            uuid primary key default gen_random_uuid(),
  gate_id       uuid not null references gates(id) on delete restrict,
  event_id      uuid not null references events(id) on delete cascade,
  uin_hash      text not null,
  result        scan_result   not null,
  denial_reason denial_reason,  -- null when result = 'grant'
  timestamp     timestamptz   not null default now(),

  check (
    (result = 'grant' and denial_reason is null) or
    (result = 'deny'  and denial_reason is not null)
  )
);

create index entry_logs_event_id_idx on entry_logs(event_id);
create index entry_logs_timestamp_idx on entry_logs(timestamp desc);

-- ─── Seat Pool (mock data helper) ─────────────────────────────────────────
-- Stores available seats per event+tier. issueTicket() claims the next untaken seat.
create table seat_pool (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events(id) on delete cascade,
  tier      ticket_tier not null,
  seat      text not null,
  taken     boolean not null default false,
  unique (event_id, tier, seat)
);

create index seat_pool_lookup_idx on seat_pool(event_id, tier, taken);

-- ─── Realtime ──────────────────────────────────────────────────────────────
-- Enable Realtime replication for entry_logs so the dashboard feed works.
-- Run this after creating the table in Supabase dashboard:
--   Realtime → Tables → entry_logs → Enable
-- Or via SQL:
alter publication supabase_realtime add table entry_logs;
