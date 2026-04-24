-- PostgREST (and @supabase/ssr) connect as anon/authenticated. Without USAGE on
-- schema public, every query fails with: permission denied for schema public (42501).
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role, anon, authenticated;
grant all on all sequences in schema public to postgres, service_role, anon, authenticated;
grant all on all functions in schema public to postgres, service_role, anon, authenticated;

alter default privileges in schema public grant all on tables to postgres, service_role, anon, authenticated;
alter default privileges in schema public grant all on sequences to postgres, service_role, anon, authenticated;
alter default privileges in schema public grant all on functions to postgres, service_role, anon, authenticated;
