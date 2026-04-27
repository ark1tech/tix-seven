-- Mock schema seed — Alembic-aligned tables (see 20260421000000_update_mock_schema.sql).

insert into mock.venue (venue_id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Mall of Asia Arena'),
  ('22222222-2222-2222-2222-222222222222', 'SMX Convention Center');

insert into mock.event (event_id, venue_id, name, start_time, end_time, capacity) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    'Sunset Music Festival 2026',
    '2026-05-15 18:00:00',
    '2026-05-15 23:00:00',
    5000
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '22222222-2222-2222-2222-222222222222',
    'TechCon Manila 2026',
    '2026-06-20 09:00:00',
    '2026-06-20 19:00:00',
    3000
  );

insert into mock.gate (gate_id, venue_id, location, status) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', '11111111-1111-1111-1111-111111111111', 'North Entrance', 'ONLINE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', '11111111-1111-1111-1111-111111111111', 'South Entrance', 'ONLINE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', '22222222-2222-2222-2222-222222222222', 'Main Hall Gate', 'ONLINE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', '22222222-2222-2222-2222-222222222222', 'Side Hall Gate', 'OFFLINE');

insert into mock.gate_assignment (assignment_id, gate_id, event_id, status, assigned_at) values
  ('a1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'ACTIVE', now()),
  ('a1000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'ACTIVE', now()),
  ('a2000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'ACTIVE', now()),
  ('a2000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'ACTIVE', now());

-- 20 links per event
insert into mock.event_ticket_link (link_id, event_id, link_hash)
select
  ('c1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'mock-event1-link-' || lpad(n::text, 4, '0')
from generate_series(1, 20) as n;

insert into mock.event_ticket_link (link_id, event_id, link_hash)
select
  ('c2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'mock-event2-link-' || lpad(n::text, 4, '0')
from generate_series(1, 20) as n;

insert into mock.ticket (ticket_id, link_id, event_id, status, created_at, used_at)
select
  ('d1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('c1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  (case when n <= 12 then 'USED' else 'UNUSED' end)::public.ticket_status,
  now() - (n * interval '2 hour'),
  case when n <= 12 then now() - (n * interval '30 minute') else null end
from generate_series(1, 20) as n;

insert into mock.ticket (ticket_id, link_id, event_id, status, created_at, used_at)
select
  ('d2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('c2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (case when n <= 10 then 'USED' else 'UNUSED' end)::public.ticket_status,
  now() - (n * interval '90 minute'),
  case when n <= 10 then now() - (n * interval '20 minute') else null end
from generate_series(1, 20) as n;

-- Logs: public.log_result (GRANTED, DENIED, …); non-GRANT rows need denial_reason (DB check).
insert into mock.log (log_id, event_id, gate_id, assignment_id, ticket_id, result, denial_reason, timestamp)
select
  ('e1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  (case when n % 2 = 0 then 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001' else 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002' end)::uuid,
  (case when n % 2 = 0 then 'a1000000-0000-0000-0000-000000000001' else 'a1000000-0000-0000-0000-000000000002' end)::uuid,
  ('d1000000-0000-0000-0000-' || lpad(((n - 1) % 20 + 1)::text, 12, '0'))::uuid,
  case
    when n % 7 = 0 then 'DENIED'::public.log_result
    else 'GRANTED'::public.log_result
  end,
  case
    when n % 7 = 0 then 'TICKET_ALREADY_USED'::public.denial_reason
    else null
  end,
  now() - ((40 - n) * interval '4 minute')
from generate_series(1, 40) as n;

insert into mock.log (log_id, event_id, gate_id, assignment_id, ticket_id, result, denial_reason, timestamp)
select
  ('e2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (case when n % 2 = 0 then 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003' else 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004' end)::uuid,
  (case when n % 2 = 0 then 'a2000000-0000-0000-0000-000000000001' else 'a2000000-0000-0000-0000-000000000002' end)::uuid,
  ('d2000000-0000-0000-0000-' || lpad(((n - 1) % 20 + 1)::text, 12, '0'))::uuid,
  case
    when n % 8 = 0 then 'DENIED'::public.log_result
    else 'GRANTED'::public.log_result
  end,
  case
    when n % 8 = 0 then 'IDENTITY_NOT_VERIFIED'::public.denial_reason
    else null
  end,
  now() - ((40 - n) * interval '3 minute')
from generate_series(1, 40) as n;
