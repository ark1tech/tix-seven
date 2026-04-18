-- TixSeven seed data
-- Run after migrations. Provides a demo event, seat pool, and a demo gate.

-- ─── Demo Event ────────────────────────────────────────────────────────────
insert into events (id, name, date, venue, capacity) values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'TixSeven Demo Concert',
  '2026-06-01 19:00:00+08',
  'Araneta Coliseum, Quezon City',
  60
);

-- ─── Seat Pool — General Admission (A1–A50) ────────────────────────────────
insert into seat_pool (event_id, tier, seat)
select
  'a1b2c3d4-0000-0000-0000-000000000001',
  'ga',
  'A' || n
from generate_series(1, 50) as n;

-- ─── Seat Pool — VIP (VIP-01–VIP-10) ──────────────────────────────────────
insert into seat_pool (event_id, tier, seat)
select
  'a1b2c3d4-0000-0000-0000-000000000001',
  'vip',
  'VIP-' || lpad(n::text, 2, '0')
from generate_series(1, 10) as n;

-- ─── Demo Gate ─────────────────────────────────────────────────────────────
insert into gates (id, event_id, name, device_id) values (
  'b2c3d4e5-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Main Entrance',
  'ESP8266-001'
);
