# Web Supabase migrations

## Authority

- **`public` schema:** defined only by [apps/gate-server/alembic/versions/](../../gate-server/alembic/versions/) (see [docs/schema-drift-inventory.md](../../../docs/schema-drift-inventory.md)).
- **This folder:** Supabase-only extras — API grants/RLS, optional `mock` schema for debug mode, etc.

## New database

1. Create a Supabase (or other Postgres) project.
2. Set `DATABASE_URL` to a connection string with DDL permission (e.g. service role or direct Postgres).
3. From the repo root:

   ```bash
   cd apps/gate-server
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   ```

4. Apply web migrations (grants/RLS + mock) using the Supabase CLI or SQL editor, in filename order, **after** step 3.

`mock` tables use the same enum types as `public` (`public.gate_status`, `public.log_result`, etc.), so **Alembic must run first** or mock migration will fail.

## RLS boundary

The current policy is single-tenant organizer access:

- `anon` has no direct app table access.
- `authenticated` can use dashboard tables for the current single organizer role.
- `public.scan_attempt_log` and `public.alembic_version` are internal/service-role-only.

This is not multi-tenant isolation. Add organizer ownership/membership tables before supporting multiple independent organizers.

## Mock schema + seed

With debug mock mode enabled (`NEXT_PUBLIC_DEBUG_TOOLS` + `debug_mock` cookie), the app uses schema `mock`.

After migrations:

```sql
\i apps/web/supabase/mock_seed.sql
```

## Realtime

Enable Realtime for `public.log` in the Supabase dashboard if you use the live entry log feed.
