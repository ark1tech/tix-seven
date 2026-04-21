-- TixSeven public schema aligned to gate-server Alembic models.
-- This migration intentionally defines the current canonical schema.

create extension if not exists "pgcrypto";

drop type if exists ticket_tier cascade;
drop type if exists scan_result cascade;
drop type if exists denial_reason cascade;

create type gate_status as enum ('ONLINE', 'OFFLINE');
create type ticket_status as enum ('UNUSED', 'USED');
create type log_result as enum ('grant', 'deny');

create table venue (
  venue_id uuid primary key default gen_random_uuid(),
  name text not null
);

create index ix_venue_name on venue(name);

create table event (
  event_id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venue(venue_id),
  name text not null,
  start_time timestamp not null,
  end_time timestamp not null,
  capacity integer not null,
  constraint check_if_event_time_valid check (end_time > start_time)
);

create index ix_event_time_range on event(start_time, end_time);
create index ix_event_venue_id on event(venue_id);

create table event_ticket_link (
  link_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references event(event_id),
  link_hash text not null unique
);

create index ix_link_event_id on event_ticket_link(event_id);
create index ix_link_hash on event_ticket_link(link_hash);

create table gate (
  gate_id uuid primary key default gen_random_uuid(),
  venue_id uuid references venue(venue_id),
  event_id uuid references event(event_id),
  location text not null,
  status gate_status not null
);

create index ix_gate_event_id on gate(event_id);
create index ix_gate_status on gate(status);
create index ix_gate_venue_id on gate(venue_id);

create table ticket (
  ticket_id uuid primary key default gen_random_uuid(),
  link_id uuid not null unique references event_ticket_link(link_id),
  status ticket_status not null default 'UNUSED',
  created_at timestamp not null default now(),
  used_at timestamp
);

create index ix_ticket_link_id on ticket(link_id);
create index ix_ticket_status on ticket(status);
create index ix_ticket_used_at on ticket(used_at);

create table log (
  log_id uuid primary key default gen_random_uuid(),
  event_id uuid references event(event_id),
  gate_id uuid not null references gate(gate_id),
  ticket_id uuid references ticket(ticket_id),
  result log_result not null,
  reason text,
  timestamp timestamp not null default now(),
  uin_hash text
);

create index ix_log_event_gate_time on log(event_id, gate_id, timestamp);
create index ix_log_event_id on log(event_id);
create index ix_log_gate_id on log(gate_id);
create index ix_log_ticket_id on log(ticket_id);
create index ix_log_timestamp on log(timestamp);

alter publication supabase_realtime add table log;
