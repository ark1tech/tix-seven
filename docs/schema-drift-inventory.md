# Schema drift inventory (checklist)

**Canonical source:** `apps/gate-server` SQLAlchemy models + Alembic under `apps/gate-server/alembic/versions/`.

Use this list when reviewing Supabase, web migrations, and `packages/types`.

## Alembic head (repo)

| Item | Expected |
|------|----------|
| Latest revision id | `f1a2b3c4d5e6` (file: `f1a2b3c4d5e6_add_scan_attempt_log_table.py`) |
| `log.check_denial_reason_consistency` | `(result = 'GRANTED'::log_result) = (denial_reason IS NULL)` |
| Table `scan_attempt_log` | Present with FKs to `gate`, `event`, `gate_assignment`, `ticket` (nullable) |
| Enum `denial_reason` | Includes `INVALID_GATE_ID`, `INVALID_GATE_ASSIGNMENT`, `WRONG_EVENT` and all values in `app/models/enums.py` |

## Live Supabase (verify with MCP / SQL)

| Check | Query / action |
|-------|----------------|
| `public.alembic_version` | `SELECT version_num FROM public.alembic_version;` → must be `f1a2b3c4d5e6` after deploy |
| `scan_attempt_log` exists | `SELECT to_regclass('public.scan_attempt_log');` |
| `denial_reason` labels | `SELECT enumlabel FROM pg_enum ... WHERE typname = 'denial_reason';` |
| `log` check constraint | `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'check_denial_reason_consistency';` |

## Web Supabase migrations (`apps/web/supabase/migrations/`)

| File | Role |
|------|------|
| `20260418000000_initial_schema.sql` | **Must not** redefine `public` tables; gate-server Alembic owns `public`. Stub or empty after bootstrap story. |
| `20260421000000_update_mock_schema.sql` | `mock` schema only; must mirror Alembic shapes (enums via `public.*`, `gate_assignment`, `log` with `assignment_id` + `denial_reason`). |
| `20260424000000_public_schema_api_grants.sql` | Grants only; review for production (broad `anon`/`authenticated` + RLS off = prototype). |

## Shared TypeScript (`packages/types/index.ts`)

| Item | Must align with |
|------|------------------|
| `DenialReason` | `app/models/enums.py` → `DenialReasonEnum` |
| `Log` | `log` row: include `assignment_id`; `denial_reason` optional |
| `EventStatus`, `AssignmentStatus` | `EventStatusEnum`, `AssignmentStatusEnum` |
| `ScanAttemptLog` | Optional; add if UI reads `scan_attempt_log` |

## Automated checks

- `scripts/verify-alembic-head.sh` — local `alembic heads` (if installed) matches `apps/gate-server/alembic/EXPECTED_HEAD`.
- Optional: `scripts/verify-remote-alembic-version.sh` — if `DATABASE_URL` is set, compares `public.alembic_version` to `EXPECTED_HEAD` (requires `psql`).

```bash
chmod +x scripts/verify-alembic-head.sh scripts/verify-remote-alembic-version.sh
./scripts/verify-alembic-head.sh
```

## Security / advisors

Run Supabase MCP `get_advisors` (security + performance) after DDL changes. See [supabase-advisors-notes.md](supabase-advisors-notes.md) for findings, decision on prototype RLS/grants, and remediation links.
