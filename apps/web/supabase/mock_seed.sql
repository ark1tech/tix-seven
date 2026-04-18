-- Mock schema seed data
-- Run after mock schema migration.
-- 2 events × 2 gates × 100 tickets × 70 entry logs

-- ─── Events ────────────────────────────────────────────────────────────────
insert into mock.events (id, name, date, venue, capacity) values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Sunset Music Festival 2026',
    '2026-05-15 18:00:00+08',
    'Mall of Asia Arena, Pasay City',
    200
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'TechCon Manila 2026',
    '2026-06-20 09:00:00+08',
    'SMX Convention Center, Pasay City',
    200
  );

-- ─── Gates ─────────────────────────────────────────────────────────────────
insert into mock.gates (id, event_id, name, device_id) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'North Entrance', 'ESP8266-N01'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'South Entrance', 'ESP8266-S01'),
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'Main Gate',      'ESP8266-M01'),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Side Gate',      'ESP8266-S02');

-- ─── Seat Pool: Event 1 (80 GA + 20 VIP) ──────────────────────────────────
insert into mock.seat_pool (event_id, tier, seat)
select 'a1000000-0000-0000-0000-000000000001', 'ga', 'A' || n
from generate_series(1, 80) n;

insert into mock.seat_pool (event_id, tier, seat)
select 'a1000000-0000-0000-0000-000000000001', 'vip', 'VIP-' || lpad(n::text, 2, '0')
from generate_series(1, 20) n;

-- ─── Seat Pool: Event 2 (80 GA + 20 VIP) ──────────────────────────────────
insert into mock.seat_pool (event_id, tier, seat)
select 'a1000000-0000-0000-0000-000000000002', 'ga', 'A' || n
from generate_series(1, 80) n;

insert into mock.seat_pool (event_id, tier, seat)
select 'a1000000-0000-0000-0000-000000000002', 'vip', 'VIP-' || lpad(n::text, 2, '0')
from generate_series(1, 20) n;

-- ─── Tickets: Event 1 (80 GA: 60 used, 20 unused; 20 VIP: 15 used, 5 unused) ─
insert into mock.tickets (event_id, uin_hash, tier, seat, status, purchase_timestamp)
select
  'a1000000-0000-0000-0000-000000000001',
  'mock1-uin-' || lpad(n::text, 4, '0'),
  'ga'::public.ticket_tier,
  'A' || n,
  (case when n <= 60 then 'used' else 'unused' end)::public.ticket_status,
  now() - (n * interval '1 hour')
from generate_series(1, 80) n;

insert into mock.tickets (event_id, uin_hash, tier, seat, status, purchase_timestamp)
select
  'a1000000-0000-0000-0000-000000000001',
  'mock1-uin-' || lpad((n + 1000)::text, 4, '0'),
  'vip'::public.ticket_tier,
  'VIP-' || lpad(n::text, 2, '0'),
  (case when n <= 15 then 'used' else 'unused' end)::public.ticket_status,
  now() - (n * interval '2 hours')
from generate_series(1, 20) n;

update mock.seat_pool set taken = true
where event_id = 'a1000000-0000-0000-0000-000000000001';

-- ─── Tickets: Event 2 (80 GA: 50 used, 30 unused; 20 VIP: 10 used, 10 unused) ─
insert into mock.tickets (event_id, uin_hash, tier, seat, status, purchase_timestamp)
select
  'a1000000-0000-0000-0000-000000000002',
  'mock2-uin-' || lpad(n::text, 4, '0'),
  'ga'::public.ticket_tier,
  'A' || n,
  (case when n <= 50 then 'used' else 'unused' end)::public.ticket_status,
  now() - (n * interval '1 hour')
from generate_series(1, 80) n;

insert into mock.tickets (event_id, uin_hash, tier, seat, status, purchase_timestamp)
select
  'a1000000-0000-0000-0000-000000000002',
  'mock2-uin-' || lpad((n + 1000)::text, 4, '0'),
  'vip'::public.ticket_tier,
  'VIP-' || lpad(n::text, 2, '0'),
  (case when n <= 10 then 'used' else 'unused' end)::public.ticket_status,
  now() - (n * interval '2 hours')
from generate_series(1, 20) n;

update mock.seat_pool set taken = true
where event_id = 'a1000000-0000-0000-0000-000000000002';

-- ─── Entry Logs: Event 1 (70 logs, ~83% grant / 17% deny) ─────────────────
insert into mock.entry_logs (gate_id, event_id, uin_hash, result, denial_reason, timestamp)
select
  (case when n % 2 = 0
    then 'b1000000-0000-0000-0000-000000000001'
    else 'b1000000-0000-0000-0000-000000000002'
  end)::uuid,
  'a1000000-0000-0000-0000-000000000001',
  'mock1-uin-' || lpad(((n - 1) % 80 + 1)::text, 4, '0'),
  (case when n % 6 = 0 then 'deny' else 'grant' end)::public.scan_result,
  (case when n % 6 = 0 then 'already_used' else null end)::public.denial_reason,
  now() - ((70 - n) * interval '5 minutes')
from generate_series(1, 70) n;

-- ─── Entry Logs: Event 2 (70 logs, ~86% grant / 14% deny) ─────────────────
insert into mock.entry_logs (gate_id, event_id, uin_hash, result, denial_reason, timestamp)
select
  (case when n % 2 = 0
    then 'b2000000-0000-0000-0000-000000000001'
    else 'b2000000-0000-0000-0000-000000000002'
  end)::uuid,
  'a1000000-0000-0000-0000-000000000002',
  'mock2-uin-' || lpad(((n - 1) % 80 + 1)::text, 4, '0'),
  (case when n % 7 = 0 then 'deny' else 'grant' end)::public.scan_result,
  (case when n % 7 = 0 then 'no_ticket' else null end)::public.denial_reason,
  now() - ((70 - n) * interval '4 minutes')
from generate_series(1, 70) n;
