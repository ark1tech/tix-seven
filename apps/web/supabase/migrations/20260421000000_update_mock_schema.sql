-- Debug-only `mock` schema, aligned with gate-server Alembic models.
-- Requires public enum types to exist (run `alembic upgrade head` in apps/gate-server first).

drop schema if exists mock cascade;
create schema mock;

create table mock.venue (
  venue_id uuid primary key default gen_random_uuid(),
  name varchar not null
);

create index ix_mock_venue_name on mock.venue (name);

create table mock.event (
  event_id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references mock.venue (venue_id),
  name varchar not null,
  status public.event_status not null default 'SCHEDULED',
  start_time timestamp not null,
  end_time timestamp not null,
  capacity integer not null,
  constraint check_if_mock_event_time_valid check (end_time > start_time)
);

create index ix_mock_event_venue_id on mock.event (venue_id);
create index ix_mock_event_status on mock.event (status);
create index ix_mock_event_time_range on mock.event (start_time, end_time);

create table mock.event_ticket_link (
  link_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references mock.event (event_id),
  link_hash varchar not null unique
);

create index ix_mock_link_event_id on mock.event_ticket_link (event_id);
create index ix_mock_link_hash on mock.event_ticket_link (link_hash);

create table mock.gate (
  gate_id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references mock.venue (venue_id),
  location varchar not null,
  status public.gate_status not null default 'OFFLINE'
);

create index ix_mock_gate_venue_id on mock.gate (venue_id);
create index ix_mock_gate_status on mock.gate (status);

create table mock.gate_assignment (
  assignment_id uuid primary key default gen_random_uuid(),
  gate_id uuid not null references mock.gate (gate_id),
  event_id uuid not null references mock.event (event_id),
  status public.assignment_status not null default 'ACTIVE',
  assigned_at timestamp not null,
  unassigned_at timestamp,
  constraint check_mock_unassigned_at_consistency check (
    (status = 'INACTIVE'::public.assignment_status) = (unassigned_at is not null)
  )
);

create index ix_mock_gate_assignment_event_id on mock.gate_assignment (event_id);
create index ix_mock_gate_assignment_gate_id on mock.gate_assignment (gate_id);
create index ix_mock_gate_assignment_status on mock.gate_assignment (status);

create table mock.ticket (
  ticket_id uuid primary key default gen_random_uuid(),
  link_id uuid unique references mock.event_ticket_link (link_id) on delete set null,
  event_id uuid not null references mock.event (event_id),
  status public.ticket_status not null default 'UNUSED',
  created_at timestamp not null default now(),
  used_at timestamp,
  constraint check_mock_used_at_consistency check (
    (status = 'USED'::public.ticket_status) = (used_at is not null)
  )
);

create index ix_mock_ticket_link_id on mock.ticket (link_id);
create index ix_mock_ticket_event_id on mock.ticket (event_id);
create index ix_mock_ticket_status on mock.ticket (status);
create index ix_mock_ticket_used_at on mock.ticket (used_at);

create table mock.log (
  log_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references mock.event (event_id),
  gate_id uuid not null references mock.gate (gate_id),
  assignment_id uuid not null references mock.gate_assignment (assignment_id),
  ticket_id uuid references mock.ticket (ticket_id),
  result public.log_result not null,
  denial_reason public.denial_reason,
  "timestamp" timestamp not null default now(),
  constraint check_mock_denial_reason_consistency check (
    (result = 'GRANTED'::public.log_result) = (denial_reason is null)
  )
);

create index ix_mock_log_event_id on mock.log (event_id);
create index ix_mock_log_gate_id on mock.log (gate_id);
create index ix_mock_log_assignment_id on mock.log (assignment_id);
create index ix_mock_log_ticket_id on mock.log (ticket_id);
create index ix_mock_log_timestamp on mock.log ("timestamp");
create index ix_mock_log_event_gate_time on mock.log (event_id, gate_id, "timestamp");

create table mock.scan_attempt_log (
  attempt_id uuid not null,
  "timestamp" timestamp not null default now(),
  gate_id_raw text not null,
  gate_id uuid references mock.gate (gate_id),
  event_id uuid references mock.event (event_id),
  assignment_id uuid references mock.gate_assignment (assignment_id),
  ticket_id uuid references mock.ticket (ticket_id),
  result public.log_result not null,
  denial_reason public.denial_reason,
  error_code text,
  constraint check_mock_scan_attempt_denial_reason_consistency check (
    (result = 'GRANTED'::public.log_result) = (denial_reason is null)
  ),
  primary key (attempt_id)
);

create index ix_mock_scan_attempt_log_timestamp on mock.scan_attempt_log ("timestamp");
create index ix_mock_scan_attempt_log_gate_id on mock.scan_attempt_log (gate_id);
create index ix_mock_scan_attempt_log_event_id on mock.scan_attempt_log (event_id);
create index ix_mock_scan_attempt_log_event_gate_time
  on mock.scan_attempt_log (event_id, gate_id, "timestamp");

grant usage on schema mock to anon, authenticated;
grant all on all tables in schema mock to anon, authenticated;
grant all on all sequences in schema mock to anon, authenticated;
