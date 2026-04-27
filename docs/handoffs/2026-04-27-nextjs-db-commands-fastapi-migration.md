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
| **Next.js (dashboard)** | Server action → gate-server `POST /dashboard/tickets/issue` | `Authorization: Bearer <access token>` + **`X-Internal-Api-Key`** (see env pairing). Optional **`X-Trace-Id`**; echoed on the response. |
| **Gate-server (hardware)** | `POST /verify` | **`X-Gate-Api-Key`** must match **`GATE_HARDWARE_API_KEY`** (or legacy `GATE_API_KEY` during rollout). |
| **Gate-server (issue)** | `POST /dashboard/tickets/issue` | **Target:** `X-Internal-Api-Key` + `Authorization: Bearer` (JWT validated with Supabase JWKS / ES256). |
| **Gate-server (issue legacy)** | `POST /tickets/issue` | **Legacy only:** `X-Gate-Api-Key` matching **`GATE_API_KEY`** until removed. |

**Status codes:** Missing or invalid authentication on protected gate-server endpoints should return **401 Unauthorized** (distinct from business-rule denials and validation errors).

**Environment pairing:**

- `apps/gate-server`: `INTERNAL_API_KEY`, `GATE_HARDWARE_API_KEY`, optional `SUPABASE_JWKS_URL` / JWT claim overrides, temporary `GATE_API_KEY`. Until split keys are set, **`GATE_API_KEY` alone** satisfies hardware auth (`POST /verify`) and internal header checks (`POST /dashboard/tickets/issue`) via server-side fallbacks; **`POST /tickets/issue` (legacy) still requires `GATE_API_KEY` explicitly** (not the hardware key alone).
- `apps/web`: `GATE_SERVER_INTERNAL_API_KEY`; optional temporary **`GATE_SERVER_API_KEY`** — used only when `GATE_SERVER_INTERNAL_API_KEY` is unset; value is sent as **`X-Internal-Api-Key`** to **`POST /dashboard/tickets/issue`** (same route as the primary flow; not used for legacy `POST /tickets/issue`).

**Rollout order:** (1) Deploy **gate-server** with **`INTERNAL_API_KEY`** + **`GATE_HARDWARE_API_KEY`**, JWKS/bearer validation, and keep **`GATE_API_KEY`** for legacy **`POST /tickets/issue`** and as a fallback if split env vars are missing. (2) Deploy **web** with **`GATE_SERVER_INTERNAL_API_KEY`** matching gate-server **`INTERNAL_API_KEY`**. (3) Validate end-to-end, move firmware to **`GATE_HARDWARE_API_KEY`**, then retire legacy **`GATE_API_KEY`** / web **`GATE_SERVER_API_KEY`** when checks pass.

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

- **Gate-server:** Keep **`GATE_API_KEY`** set during migration for **`POST /tickets/issue`** (legacy) and, if needed, as the configured fallback for **`POST /verify`** and internal-key checks when split env vars are missing. **`GATE_SERVER_API_KEY` is web-only** — it is not read by gate-server.
- **Web:** If `GATE_SERVER_INTERNAL_API_KEY` is wrong or missing while gate-server still accepts the legacy shared key as the effective internal secret, temporarily set **`GATE_SERVER_API_KEY`** to match gate-server **`GATE_API_KEY`** so **`X-Internal-Api-Key`** validates again (still calling **`POST /dashboard/tickets/issue`** with bearer). If dashboard issue must be bypassed entirely, point a controlled caller at **`POST /tickets/issue`** with **`X-Gate-Api-Key`** only (no bearer) until the primary path is fixed.
- **Secrets:** Rotating `INTERNAL_API_KEY` requires simultaneous update on gate-server and Vercel (web). Plan a short maintenance window or blue/green env injection.

---

## Readiness checklist (before removing legacy keys)

- [ ] All ESP8266 devices flashed to use `GATE_HARDWARE_API_KEY` (or confirmed proxy path).
- [ ] Next.js production uses `GATE_SERVER_INTERNAL_API_KEY` and no longer depends on `GATE_SERVER_API_KEY` for issue.
- [ ] Gate-server rejects anonymous issue attempts with **401**; JWT validation via Supabase JWKS is healthy.
- [ ] Dashboard E2E: login → issue ticket → gate scan grant.
- [ ] Alerts/dashboards for 401 spikes and verification error rates.
- [ ] Remaining event/gate command migrations scheduled or tracked (see inventory above).

---

## Notes

- Header name **`X-Internal-Api-Key`** is the contract for dashboard **`POST /dashboard/tickets/issue`** calls (never `X-Gate-Api-Key` on that route).
- Both gate-server and web retain temporary legacy-key compatibility during rollout; retiring **`GATE_API_KEY`** / **`GATE_SERVER_API_KEY`** is safe only after inventory checks pass and traffic no longer depends on legacy paths.
