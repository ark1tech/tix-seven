# Handoff: Next.js DB commands → FastAPI (hybrid auth / env rollout)

**Date:** 2026-04-27  
**Scope:** Post–ticket-issue cutover notes, remaining command modules that still use Next.js `lib/db` + Route Handlers, and the hybrid authentication contract between `apps/web` and `apps/gate-server`.

---

## Migration order (remaining command modules)

Recommended sequence minimizes foreign-key and operational risk:

1. **Events** — Migrate `createEvent` and `updateEvent` first. Gates and ticket links depend on stable `event` rows; event CRUD is the foundation for gate assignments and issuance context.
2. **Gates** — Migrate `createGate`, `updateGate`, and `deleteGate` after events. Gate rows and `gate_assignment` interact with verification and entry logging; keep event migration tested before moving gate writes off Supabase-direct paths.

For each module: add FastAPI commands (or extend existing services), mirror validation (Zod ↔ Pydantic), point Next.js Route Handlers or server actions at the new HTTP surface, then delete or thin the corresponding `lib/db` write helpers only when reads are also migrated or intentionally left on Supabase.

---

## API contract and auth model (summary)

| Layer | Route / surface | Authentication |
| --- | --- | --- |
| **Next.js (dashboard)** | Server action → gate-server `POST /dashboard/tickets/issue` | `Authorization: Bearer <access token>` + **`X-Internal-Api-Key`**. Optional **`X-Trace-Id`**; echoed on the response. |
| **Gate-server (hardware)** | `POST /verify` | **`X-Gate-Api-Key`** must match **`GATE_HARDWARE_API_KEY`**. |
| **Gate-server (issue)** | `POST /dashboard/tickets/issue` | `X-Internal-Api-Key` matching `INTERNAL_API_KEY` + `Authorization: Bearer` (JWT validated with Supabase JWKS / ES256). |

**Status codes:** Missing or invalid authentication on protected gate-server endpoints returns **401 Unauthorized** (distinct from business-rule denials and validation errors).

**Environment pairing (current — legacy removed 2026-04-27):**

- `apps/gate-server`: `INTERNAL_API_KEY`, `GATE_HARDWARE_API_KEY`, optional `SUPABASE_JWKS_URL` / JWT claim overrides. Both keys are required at startup.
- `apps/web`: `GATE_SERVER_INTERNAL_API_KEY` — required; `GATE_SERVER_API_KEY` fallback has been removed.

---

## Inventory: remaining Next.js DB command paths

These writes still run through Supabase from the Next.js server using `createClient()`:

| Module | Functions | API surfaces (Next.js App Router) |
| --- | --- | --- |
| `apps/web/lib/db/events.ts` | `createEvent`, `updateEvent` | `apps/web/app/api/events/route.ts` (`POST`), `apps/web/app/api/events/[eventId]/route.ts` (`PATCH`) |
| `apps/web/lib/db/gates.ts` | `createGate`, `updateGate`, `deleteGate` | `apps/web/app/api/gates/route.ts` (`POST`), `apps/web/app/api/gates/[gateId]/route.ts` (`PATCH`, `DELETE`) |

**Reads** in the same modules (`getEvents`, `getEvent`, `getGates`, etc.) are out of scope for this handoff title but typically migrate after writes or together with a single FastAPI “resource” boundary per aggregate.

---

## Test deltas / checklist

**Gate-server**

- [ ] `POST /verify` without `X-Gate-Api-Key` → **401**.
- [ ] `POST /verify` with wrong key → **401**.
- [ ] `POST /dashboard/tickets/issue` without internal key and/or bearer → **401**.
- [ ] `POST /tickets/issue` with legacy `X-Gate-Api-Key` only → allowed until legacy removal; then **401**.
- [ ] Happy path: issue with internal + valid JWT → **201**; verify with hardware key → **200** grant/deny JSON unchanged.

**Web**

- [ ] `issueTicketAction` returns `unauthorized` when no Supabase session/access token is available.
- [ ] Authenticated issue flow reaches gate-server with both bearer forward and internal key.
- [ ] After cutover, remove or ignore `GATE_SERVER_API_KEY` in client code paths.

**Integration**

- [ ] Staging: deploy gate-server with new env, then web; run one full registration + one gate scan.
- [ ] Production: repeat with monitoring on 401 rate and MOSIP timeouts.

---

## Rollback notes

Legacy paths have been removed as of 2026-04-27. There is no code-level rollback path for legacy `POST /tickets/issue` or `GATE_API_KEY` fallbacks; re-introducing them would require reverting the relevant commits.

- **Gate-server:** `GATE_API_KEY` and the `effective_*` fallback properties are gone. `INTERNAL_API_KEY` and `GATE_HARDWARE_API_KEY` are now required at startup.
- **Web:** `GATE_SERVER_API_KEY` fallback is removed. Only `GATE_SERVER_INTERNAL_API_KEY` is read.
- **Secrets:** Rotating `INTERNAL_API_KEY` requires a simultaneous update on gate-server and Vercel (web). Plan a short maintenance window or blue/green env injection.

---

## Readiness checklist (legacy removal — completed 2026-04-27)

- [x] All ESP8266 devices flashed to use `GATE_HARDWARE_API_KEY` (or confirmed proxy path).
- [x] Next.js production uses `GATE_SERVER_INTERNAL_API_KEY` and no longer depends on `GATE_SERVER_API_KEY` for issue.
- [x] Gate-server rejects anonymous issue attempts with **401**; JWT validation via Supabase JWKS is healthy.
- [x] Dashboard E2E: login → issue ticket → gate scan grant.
- [x] Alerts/dashboards for 401 spikes and verification error rates.
- [ ] Remaining event/gate command migrations scheduled or tracked (see inventory above).

---

## Notes

- Header name **`X-Internal-Api-Key`** is the contract for dashboard **`POST /dashboard/tickets/issue`** calls (never `X-Gate-Api-Key` on that route).
- Both gate-server and web retain temporary legacy-key compatibility during rollout; retiring **`GATE_API_KEY`** / **`GATE_SERVER_API_KEY`** is safe only after inventory checks pass and traffic no longer depends on legacy paths.
