-- Mock schema: mirrors public schema tables for debug/demo data switching

create schema if not exists mock;

create table mock.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        timestamptz not null,
  venue       text not null,
  capacity    integer not null check (capacity > 0),
  created_at  timestamptz not null default now()
);

create table mock.tickets (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references mock.events(id) on delete cascade,
  uin_hash           text not null,
  tier               public.ticket_tier   not null,
  seat               text not null,
  status             public.ticket_status not null default 'unused',
  purchase_timestamp timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (event_id, uin_hash)
);

create index mock_tickets_event_id_idx on mock.tickets(event_id);
create index mock_tickets_uin_hash_idx on mock.tickets(uin_hash);

create table mock.gates (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references mock.events(id) on delete set null,
  name       text not null,
  device_id  text not null unique,
  created_at timestamptz not null default now()
);

create index mock_gates_event_id_idx on mock.gates(event_id);

create table mock.entry_logs (
  id            uuid primary key default gen_random_uuid(),
  gate_id       uuid not null references mock.gates(id) on delete restrict,
  event_id      uuid not null references mock.events(id) on delete cascade,
  uin_hash      text not null,
  result        public.scan_result   not null,
  denial_reason public.denial_reason,
  timestamp     timestamptz not null default now(),
  check (
    (result = 'grant' and denial_reason is null) or
    (result = 'deny'  and denial_reason is not null)
  )
);

create index mock_entry_logs_event_id_idx on mock.entry_logs(event_id);
create index mock_entry_logs_timestamp_idx on mock.entry_logs(timestamp desc);

create table mock.seat_pool (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references mock.events(id) on delete cascade,
  tier      public.ticket_tier not null,
  seat      text not null,
  taken     boolean not null default false,
  unique (event_id, tier, seat)
);

create index mock_seat_pool_lookup_idx on mock.seat_pool(event_id, tier, taken);

-- Enable realtime on mock.entry_logs (same as public.entry_logs)
alter publication supabase_realtime add table mock.entry_logs;

-- ─── Permissions ───────────────────────────────────────────────────────────
grant usage on schema mock to anon, authenticated;
grant all on all tables in schema mock to anon, authenticated;
grant all on all sequences in schema mock to anon, authenticated;
