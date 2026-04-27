-- Single-tenant RLS boundary for the organizer dashboard.
--
-- Policy:
-- - `anon` gets no table access.
-- - `authenticated` can use dashboard-owned tables.
-- - internal/operational tables (`alembic_version`, `scan_attempt_log`) are service-role only.
-- - `mock` mirrors the dashboard boundary for debug mode.

grant usage on schema public to authenticated, service_role;
revoke usage on schema public from anon;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
revoke all on all functions in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public revoke all on functions from authenticated;

revoke all on table public.alembic_version from anon, authenticated;
revoke all on table public.scan_attempt_log from anon, authenticated;

grant select, insert, update on table public.venue to authenticated;
grant select, insert, update on table public.event to authenticated;
grant select, insert, update, delete on table public.gate to authenticated;
grant select, insert, update, delete on table public.gate_assignment to authenticated;
grant select on table public.event_ticket_link to authenticated;
grant select on table public.ticket to authenticated;
grant select on table public.log to authenticated;

alter table public.alembic_version enable row level security;
alter table public.venue enable row level security;
alter table public.event enable row level security;
alter table public.gate enable row level security;
alter table public.event_ticket_link enable row level security;
alter table public.gate_assignment enable row level security;
alter table public.ticket enable row level security;
alter table public.log enable row level security;
alter table public.scan_attempt_log enable row level security;

drop policy if exists authenticated_dashboard_access on public.venue;
drop policy if exists authenticated_dashboard_access on public.event;
drop policy if exists authenticated_dashboard_access on public.gate;
drop policy if exists authenticated_dashboard_access on public.gate_assignment;
drop policy if exists authenticated_dashboard_read on public.event_ticket_link;
drop policy if exists authenticated_dashboard_read on public.ticket;
drop policy if exists authenticated_dashboard_read on public.log;

create policy authenticated_dashboard_access
  on public.venue
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_dashboard_access
  on public.event
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_dashboard_access
  on public.gate
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_dashboard_access
  on public.gate_assignment
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_dashboard_read
  on public.event_ticket_link
  for select
  to authenticated
  using (true);

create policy authenticated_dashboard_read
  on public.ticket
  for select
  to authenticated
  using (true);

create policy authenticated_dashboard_read
  on public.log
  for select
  to authenticated
  using (true);

-- Debug schema is optional. Harden it if it exists.
do $$
begin
  if to_regclass('mock.venue') is not null then
    grant usage on schema mock to authenticated, service_role;
    revoke usage on schema mock from anon;

    revoke all on all tables in schema mock from anon;
    revoke all on all sequences in schema mock from anon;
    revoke all on all tables in schema mock from authenticated;
    revoke all on all sequences in schema mock from authenticated;
    alter default privileges in schema mock revoke all on tables from anon;
    alter default privileges in schema mock revoke all on sequences from anon;
    alter default privileges in schema mock revoke all on tables from authenticated;
    alter default privileges in schema mock revoke all on sequences from authenticated;

    grant select, insert, update on table mock.venue to authenticated;
    grant select, insert, update on table mock.event to authenticated;
    grant select, insert, update, delete on table mock.gate to authenticated;
    grant select, insert, update, delete on table mock.gate_assignment to authenticated;
    grant select on table mock.event_ticket_link to authenticated;
    grant select on table mock.ticket to authenticated;
    grant select on table mock.log to authenticated;
    revoke all on table mock.scan_attempt_log from anon, authenticated;

    alter table mock.venue enable row level security;
    alter table mock.event enable row level security;
    alter table mock.gate enable row level security;
    alter table mock.event_ticket_link enable row level security;
    alter table mock.gate_assignment enable row level security;
    alter table mock.ticket enable row level security;
    alter table mock.log enable row level security;
    alter table mock.scan_attempt_log enable row level security;

    drop policy if exists authenticated_dashboard_access on mock.venue;
    drop policy if exists authenticated_dashboard_access on mock.event;
    drop policy if exists authenticated_dashboard_access on mock.gate;
    drop policy if exists authenticated_dashboard_access on mock.gate_assignment;
    drop policy if exists authenticated_dashboard_read on mock.event_ticket_link;
    drop policy if exists authenticated_dashboard_read on mock.ticket;
    drop policy if exists authenticated_dashboard_read on mock.log;

    create policy authenticated_dashboard_access
      on mock.venue
      for all
      to authenticated
      using (true)
      with check (true);

    create policy authenticated_dashboard_access
      on mock.event
      for all
      to authenticated
      using (true)
      with check (true);

    create policy authenticated_dashboard_access
      on mock.gate
      for all
      to authenticated
      using (true)
      with check (true);

    create policy authenticated_dashboard_access
      on mock.gate_assignment
      for all
      to authenticated
      using (true)
      with check (true);

    create policy authenticated_dashboard_read
      on mock.event_ticket_link
      for select
      to authenticated
      using (true);

    create policy authenticated_dashboard_read
      on mock.ticket
      for select
      to authenticated
      using (true);

    create policy authenticated_dashboard_read
      on mock.log
      for select
      to authenticated
      using (true);
  end if;
end $$;
