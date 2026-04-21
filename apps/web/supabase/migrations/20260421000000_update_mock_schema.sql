-- Sync mock schema with Alembic table design used by web app.
-- This migration intentionally rebuilds mock schema from scratch.

drop schema if exists mock cascade;
create schema mock;

create table mock.venue (
  venue_id uuid primary key default gen_random_uuid(),
  name text not null
);

create index ix_mock_venue_name on mock.venue(name);

create table mock.event (
  event_id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references mock.venue(venue_id),
  name text not null,
  start_time timestamp not null,
  end_time timestamp not null,
  capacity integer not null,
  constraint check_if_mock_event_time_valid check (end_time > start_time)
);

create index ix_mock_event_time_range on mock.event(start_time, end_time);
create index ix_mock_event_venue_id on mock.event(venue_id);

create table mock.event_ticket_link (
  link_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references mock.event(event_id),
  link_hash text not null unique
);

create index ix_mock_link_event_id on mock.event_ticket_link(event_id);
create index ix_mock_link_hash on mock.event_ticket_link(link_hash);

create table mock.gate (
  gate_id uuid primary key default gen_random_uuid(),
  venue_id uuid references mock.venue(venue_id),
  event_id uuid references mock.event(event_id),
  location text not null,
  status public.gate_status not null
);

create index ix_mock_gate_event_id on mock.gate(event_id);
create index ix_mock_gate_status on mock.gate(status);
create index ix_mock_gate_venue_id on mock.gate(venue_id);

create table mock.ticket (
  ticket_id uuid primary key default gen_random_uuid(),
  link_id uuid not null unique references mock.event_ticket_link(link_id),
  status public.ticket_status not null,
  created_at timestamp not null default now(),
  used_at timestamp
);

create index ix_mock_ticket_link_id on mock.ticket(link_id);
create index ix_mock_ticket_status on mock.ticket(status);
create index ix_mock_ticket_used_at on mock.ticket(used_at);

create table mock.log (
  log_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references mock.event(event_id),
  gate_id uuid not null references mock.gate(gate_id),
  ticket_id uuid references mock.ticket(ticket_id),
  result public.log_result not null,
  reason text,
  timestamp timestamp not null default now()
);

create index ix_mock_log_event_gate_time on mock.log(event_id, gate_id, timestamp);
create index ix_mock_log_event_id on mock.log(event_id);
create index ix_mock_log_gate_id on mock.log(gate_id);
create index ix_mock_log_ticket_id on mock.log(ticket_id);
create index ix_mock_log_timestamp on mock.log(timestamp);

grant usage on schema mock to anon, authenticated;
grant all on all tables in schema mock to anon, authenticated;
grant all on all sequences in schema mock to anon, authenticated;
