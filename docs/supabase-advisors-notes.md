# Supabase advisors (snapshot)

Run after DDL changes: Supabase MCP `get_advisors` with `security` and `performance`, or Dashboard → Database → Advisors.

## Security (single-tenant organizer stance)

| Finding | Level | Notes |
|--------|-------|--------|
| RLS enabled with no policies on `public.alembic_version` and `public.scan_attempt_log` | INFO | Intentional. These are internal/service-role-only tables; browser roles receive no table grants or policies. |
| Leaked password protection disabled (Auth) | WARN | Enable in Auth settings. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

## Performance

| Finding | Level | Notes |
|--------|-------|--------|
| Unindexed FKs on `scan_attempt_log(assignment_id)`, `scan_attempt_log(ticket_id)` | INFO | Consider adding indexes matching FK columns if you query by these; gate-server model already indexes `gate_id` / `event_id` / time. [Remediation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| Many “unused index” hints | INFO | Normal on low-traffic / new tables; revisit after real load. |
| Auth RLS initplan warnings | RESOLVED | RLS predicates use `(select auth.uid())` after `20260427001954_optimize_single_tenant_rls_predicates.sql`. |

**Decision:** Current DB policy is **single-tenant organizer** security:

- `anon` has no app table access.
- `authenticated` can use the dashboard tables required by the current app.
- `scan_attempt_log` and `alembic_version` are internal/service-role-only.

This is safe enough for a single organizer role, but it is **not** multi-tenant isolation. Add organizer ownership/membership tables before hosting multiple independent organizers.
