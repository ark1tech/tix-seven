-- Public (`public`) schema is owned by **apps/gate-server** Alembic migrations.
-- Do not recreate core tables, enums, or constraints in this repository.
--
-- Bootstrap a new database:
--   1. Set `DATABASE_URL` to your Supabase/Postgres connection string.
--   2. From `apps/gate-server`, run: `alembic upgrade head`
--   3. Apply the remaining Supabase-only migrations in this folder (grants, mock, etc.).
--
-- See: docs/schema-drift-inventory.md

create extension if not exists pgcrypto;
