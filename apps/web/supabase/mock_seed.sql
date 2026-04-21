-- Mock schema seed data for Alembic-compatible table design.
-- Seeds only the mock schema.

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

insert into mock.gate (gate_id, venue_id, event_id, location, status) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'North Entrance', 'ONLINE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'South Entrance', 'ONLINE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Main Hall Gate', 'ONLINE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Side Hall Gate', 'OFFLINE');

-- Create 20 links per event.
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

-- Build matching tickets with mixed statuses.
insert into mock.ticket (ticket_id, link_id, status, created_at, used_at)
select
  ('d1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('c1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  (case when n <= 12 then 'USED' else 'UNUSED' end)::public.ticket_status,
  now() - (n * interval '2 hour'),
  case when n <= 12 then now() - (n * interval '30 minute') else null end
from generate_series(1, 20) as n;

insert into mock.ticket (ticket_id, link_id, status, created_at, used_at)
select
  ('d2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('c2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  (case when n <= 10 then 'USED' else 'UNUSED' end)::public.ticket_status,
  now() - (n * interval '90 minute'),
  case when n <= 10 then now() - (n * interval '20 minute') else null end
from generate_series(1, 20) as n;

-- Build 40 logs per event with mostly grant results.
insert into mock.log (log_id, event_id, gate_id, ticket_id, result, reason, timestamp, uin_hash)
select
  ('e1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  (case when n % 2 = 0 then 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001' else 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002' end)::uuid,
  ('d1000000-0000-0000-0000-' || lpad(((n - 1) % 20 + 1)::text, 12, '0'))::uuid,
  (case when n % 7 = 0 then 'deny' else 'grant' end)::public.log_result,
  case when n % 7 = 0 then 'already_used' else null end,
  now() - ((40 - n) * interval '4 minute'),
  null
from generate_series(1, 40) as n;

insert into mock.log (log_id, event_id, gate_id, ticket_id, result, reason, timestamp, uin_hash)
select
  ('e2000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  (case when n % 2 = 0 then 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003' else 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004' end)::uuid,
  ('d2000000-0000-0000-0000-' || lpad(((n - 1) % 20 + 1)::text, 12, '0'))::uuid,
  (case when n % 8 = 0 then 'deny' else 'grant' end)::public.log_result,
  case when n % 8 = 0 then 'invalid_id' else null end,
  now() - ((40 - n) * interval '3 minute'),
  null
from generate_series(1, 40) as n;
