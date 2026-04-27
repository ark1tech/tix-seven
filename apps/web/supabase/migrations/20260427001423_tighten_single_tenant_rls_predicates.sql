-- Replace constant-true single-tenant RLS predicates with an explicit
-- authenticated-session predicate. This keeps the same single-tenant model
-- while avoiding policies that are literally `USING (true)`.

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
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy authenticated_dashboard_access
  on public.event
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy authenticated_dashboard_access
  on public.gate
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy authenticated_dashboard_access
  on public.gate_assignment
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy authenticated_dashboard_read
  on public.event_ticket_link
  for select
  to authenticated
  using (auth.uid() is not null);

create policy authenticated_dashboard_read
  on public.ticket
  for select
  to authenticated
  using (auth.uid() is not null);

create policy authenticated_dashboard_read
  on public.log
  for select
  to authenticated
  using (auth.uid() is not null);

do $$
begin
  if to_regclass('mock.venue') is not null then
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
      using (auth.uid() is not null)
      with check (auth.uid() is not null);

    create policy authenticated_dashboard_access
      on mock.event
      for all
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null);

    create policy authenticated_dashboard_access
      on mock.gate
      for all
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null);

    create policy authenticated_dashboard_access
      on mock.gate_assignment
      for all
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null);

    create policy authenticated_dashboard_read
      on mock.event_ticket_link
      for select
      to authenticated
      using (auth.uid() is not null);

    create policy authenticated_dashboard_read
      on mock.ticket
      for select
      to authenticated
      using (auth.uid() is not null);

    create policy authenticated_dashboard_read
      on mock.log
      for select
      to authenticated
      using (auth.uid() is not null);
  end if;
end $$;
