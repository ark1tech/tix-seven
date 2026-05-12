# TixSeven Gate Server

Python FastAPI service that receives PhilSys QR payloads from ESP8266 gate hardware and returns grant/deny decisions in real time.

## Overview

```
Organizer dashboard ──server action──▶ gate-server POST /dashboard/tickets/issue
   (session → Authorization: Bearer <JWT>)      (X-Internal-Api-Key + Bearer)

ESP8266 gate  ──POST /verify + X-Gate-Api-Key──▶  gate-server  ──▶  MOSIP IDA (QR verification)
                                      │
                                      ▼
                               Supabase / Postgres
            (gates, tickets, event_ticket_links, log, scan_attempt_log)
```

A physical gate device scans a PhilSys QR code, sends the raw payload to this server with the hardware API key in `X-Gate-Api-Key`, and receives either `{"result":"grant"}` or `{"result":"deny","reason":"..."}`. The server verifies the QR against MOSIP's Identity Authentication API, checks that the attendee holds a valid unused ticket for the correct event, atomically marks the ticket used, and writes audit rows (see [Audit and logging](#audit-and-logging)).

The organizer dashboard issues tickets through a **Next.js server action** that calls this FastAPI app’s **`POST /dashboard/tickets/issue`** route with `Authorization: Bearer <access token>` plus `X-Internal-Api-Key`. Hardware never uses that path; it uses **`POST /verify`** only.

### Routes and credentials (target contract)

| Caller | Gate-server route | Required credentials |
| --- | --- | --- |
| ESP8266 firmware | `POST /verify` | `X-Gate-Api-Key` matching `GATE_HARDWARE_API_KEY` (see `.env.example`) |
| Next.js (dashboard) | `POST /dashboard/tickets/issue` | `X-Internal-Api-Key` matching `INTERNAL_API_KEY`, plus `Authorization: Bearer` for the organizer JWT |

Missing or invalid authentication on protected gate-server routes should return **401 Unauthorized** (not 403), so clients can distinguish auth failures from forbidden business rules.

### Credential setup

Each service uses its own key. Set both in `.env` before starting:

- `INTERNAL_API_KEY` — server-to-server; must match `GATE_SERVER_INTERNAL_API_KEY` in the web app
- `GATE_HARDWARE_API_KEY` — firmware-to-gate; set on ESP8266 devices

Legacy single-key rollout is complete; `GATE_API_KEY` has been retired.

## Audit and logging

Two tables are used on `POST /verify`:

| Table | Purpose |
| --- | --- |
| `scan_attempt_log` | **Every** scan attempt, including pre-resolution failures (e.g. malformed `gate_id` or no active gate assignment). Stores the raw `gate_id` string, optional parsed UUID and FKs, `result` / `denial_reason`, and an optional `error_code` (internal marker such as `DENY_INVALID_GATE_ID`). |
| `log` | Event-linked operational audit when a gate and event are known. Requires valid `gate_id` UUID, `event_id`, and `assignment_id` (FK to `gate`, `event`, `gate_assignment`). Omitted for early failures where those cannot be resolved. |

**Deny** responses from the device API use the `denial_reason` enum **values** in JSON (e.g. `INVALID_GATE_ID`, `TICKET_NOT_FOUND`). The database stores the same enum on both tables.

### Demo presentation logging

For a live demo (e.g. AWS log tail), optional `[DEMO]` log lines summarize UIN/PSUT, MOSIP outcome, and ticket state. They are separate from structured technical logs and do **not** write full identity values to the database.

| Variable | Description |
| --- | --- |
| `DEMO_LOG_IDENTITY_VALUES` | When `true`, `[DEMO]` lines include full UIN and PSUT. Default `false` masks to last four digits. |
| `DEMO_DISABLE_MOSIP_AUTHENTICATOR` | When `true`, the MOSIP SDK is not initialized (no credential bundle required); identity verification always fails with a clear `[DEMO] CRYPTOGRAPHIC AUTHENTICATION FAILED` style message. |

## Prerequisites

- Python 3.12 or 3.13
- A Supabase project (or any Postgres 14+ instance)
- `libpq` / Postgres client libraries installed locally (required by `psycopg2-binary` on some systems — usually satisfied on macOS via `brew install libpq`)

## Setup

### 1. Create and activate a virtual environment

Always activate the venv **before** running any `pip` or `uvicorn` commands. Skipping this step is the most common cause of `ModuleNotFoundError` on startup.

```bash
cd apps/gate-server
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

### 2. Install dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The `mosip-auth-sdk` dependency is installed directly from GitHub — an internet connection is required on first install.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase Dashboard → Project Settings → API. Bypasses RLS — keep secret. |
| `SUPABASE_JWKS_URL` | Optional Supabase JWKS endpoint override. If empty, derived as `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. |
| `SUPABASE_JWT_EXPECTED_ISS` | Optional JWT issuer override. Defaults to `<SUPABASE_URL>/auth/v1`. |
| `SUPABASE_JWT_EXPECTED_AUD` | Optional JWT audience override. Defaults to `authenticated`. |
| `DATABASE_URL` | Direct Postgres URI. Get from Supabase Dashboard → Project Settings → Database → URI. Use port **5432** (not the pooler). |
| `HMAC_PEPPER` | 32-byte hex secret. **Must match `HMAC_PEPPER` in the web app `.env.local`.** Generate: `openssl rand -hex 32` |
| `INTERNAL_API_KEY` | Pre-shared key for trusted backends (Next.js). Sent as `X-Internal-Api-Key` on `POST /dashboard/tickets/issue`. Must match `GATE_SERVER_INTERNAL_API_KEY` in the web app. |
| `GATE_HARDWARE_API_KEY` | Pre-shared key for ESP8266 on `POST /verify` (`X-Gate-Api-Key`). Generate: `openssl rand -hex 32` |
| `DEMO_LOG_IDENTITY_VALUES` | Optional. `true` logs full UIN/PSUT in `[DEMO]` lines; default masks. |
| `DEMO_DISABLE_MOSIP_AUTHENTICATOR` | Optional. `true` skips MOSIP SDK init for demo-only runs. See [Demo presentation logging](#demo-presentation-logging). |

For end-to-end MOSIP (issue ticket / verify), you need both **MOSIP env vars in `.env`** and the **three credential files** under `credentials/`; tests inject `StubMOSIPAdapter` only. See [MOSIP Credentials](#mosip-credentials) below.

### 4. Run database migrations

```bash
# Still inside apps/gate-server with venv active
alembic upgrade head
```

This creates all tables (`venue`, `event`, `event_ticket_link`, `gate`, `gate_assignment`, `ticket`, `log`, `scan_attempt_log`, …) on the target database. Alembic reads `DATABASE_URL` from `.env` automatically.

To roll back to a clean state:

```bash
alembic downgrade base
```

## Running Locally

Use the module form of `uvicorn` to ensure it runs inside the active venv:

```bash
python -m uvicorn app.main:app --reload
```

The server starts on `http://127.0.0.1:8000`. On startup it runs a DB connectivity check — if the database is unreachable the process exits immediately.

Interactive API docs: `http://127.0.0.1:8000/docs`

## Automated Tests

Tests use FastAPI's `TestClient` with dependency injection overrides — **no real database or MOSIP connection is required**.

`tests/conftest.py` wires up:
- `FakeSession` — in-memory stub that satisfies the SQLAlchemy `Session` interface
- `StubMOSIPAdapter` — accepts any non-empty QR string and returns a mock UIN
- `get_verification_service` dependency override so the router uses both stubs

```bash
# Run all tests
pytest

# Verbose output
pytest -v

# Stop on first failure
pytest -x
```

The test suite covers:
- `GET /health` returns `{"status":"ok","db":"ok"}`
- `POST /verify` rejects requests missing or invalid hardware auth (**401**)
- `POST /dashboard/tickets/issue` rejects requests missing/invalid internal key or bearer (**401**)
- Every denial branch and scan-audit behavior (see tests): e.g. `INVALID_GATE_ID`, `INVALID_GATE_ASSIGNMENT`, `LINK_NOT_FOUND`, `TICKET_NOT_FOUND`, `TICKET_ALREADY_USED`, MOSIP `SERVER_TIMEOUT`
- Grant path: marks ticket used, returns `ticket_id`

## Manual Smoke Tests

Make sure the server is running (`python -m uvicorn app.main:app --reload`) and substitute your hardware key (`GATE_HARDWARE_API_KEY`).

### Health check

```bash
curl http://127.0.0.1:8000/health
```

Expected:
```json
{"status":"ok","db":"ok"}
```

### Auth guard (no key)

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://127.0.0.1:8000/verify \
  -H "Content-Type: application/json" \
  -d '{"qr_payload":"test","gate_id":"11111111-1111-1111-1111-111111111111"}'
```

Expected: **401**

### Deny — invalid QR (empty payload)

```bash
curl -X POST http://127.0.0.1:8000/verify \
  -H "Content-Type: application/json" \
  -H "X-Gate-Api-Key: YOUR_GATE_HARDWARE_API_KEY" \
  -d '{"qr_payload":"","gate_id":"11111111-1111-1111-1111-111111111111"}'
```

Expected:
```json
{"result":"deny","ticket_id":null,"reason":"IDENTITY_NOT_VERIFIED"}
```

(Empty QR is treated as failed identity verification once the gate and event are resolved; malformed `gate_id` returns e.g. `INVALID_GATE_ID`.)

### Deny — gate not assigned to an event

```bash
curl -X POST http://127.0.0.1:8000/verify \
  -H "Content-Type: application/json" \
  -H "X-Gate-Api-Key: YOUR_GATE_HARDWARE_API_KEY" \
  -d '{"qr_payload":"1234567890123456|2000-01-01","gate_id":"<valid-gate-uuid>"}'
```

With a real DB but no `event_id` set on the gate row, expected:
```json
{"result":"deny","ticket_id":null,"reason":"INVALID_GATE_ASSIGNMENT"}
```

### Issue ticket (dashboard route: internal key + bearer)

```bash
curl -X POST http://127.0.0.1:8000/dashboard/tickets/issue \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: YOUR_INTERNAL_API_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_JWT" \
  -d '{"qr_payload":"{\"uin\":\"123456789012\",\"name\":\"Sample User\"}","event_id":"<valid-event-uuid>"}'
```

Expected success:
```json
{"ticket_id":"<uuid>","link_id":"<uuid>","status":"UNUSED","created_at":"<timestamp>"}
```

## Project Structure

```
gate-server/
├── app/
│   ├── adapters/
│   │   └── mosip.py          # MOSIPAdapter protocol + RealMOSIPAdapter + StubMOSIPAdapter
│   ├── core/
│   │   ├── config.py         # Pydantic settings (reads .env)
│   │   └── crypto.py         # hash_uin() — HMAC-SHA256 with pepper
│   ├── db/
│   │   ├── base.py           # SQLAlchemy declarative base
│   │   ├── get_db.py         # get_db() FastAPI dependency
│   │   └── session.py        # Engine + SessionLocal
│   ├── models/
│   │   ├── enums.py          # GateStatusEnum, TicketStatusEnum, ResultEnum
│   │   ├── event.py          # Event ORM model
│   │   ├── eventticketlink.py # EventTicketLink ORM model
│   │   ├── gate.py           # Gate ORM model
│   │   ├── log.py            # Log ORM model (event-linked)
│   │   ├── scan_attempt_log.py # every /verify attempt (incl. pre-resolution)
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── ticket.py         # Ticket ORM model
│   │   └── venue.py          # Venue ORM model
│   ├── routers/
│   │   ├── health.py         # GET /health
│   │   ├── issue.py          # POST /tickets/issue + /dashboard/tickets/issue
│   │   └── verify.py         # POST /verify (auth + DI wiring)
│   ├── services/
│   │   ├── issuance.py       # IssuanceService — ticket registration flow
│   │   └── verification.py   # VerificationService — core business logic
│   └── main.py               # FastAPI app, middleware, router includes
├── alembic/                  # Alembic migration environment
│   └── versions/             # Migration scripts
├── tests/
│   ├── conftest.py           # Fixtures: FakeSession, StubMOSIPAdapter, TestClient
│   ├── test_issue.py         # Ticket issuance endpoint/service tests
│   └── test_verify.py        # Full endpoint test suite
├── .env.example              # Environment variable template
├── Dockerfile
├── railway.json              # Railway deployment config
└── requirements.txt
```

## API Reference

### `GET /health`

Returns server and database status. Used by Railway health checks.

**Response 200**
```json
{"status": "ok", "db": "ok"}
```

**Response 503** — database unreachable
```json
{"detail": "Database unavailable"}
```

---

### `POST /verify`

Verifies a PhilSys QR payload and returns a grant or deny decision.

**Headers**

| Header | Required | Description |
|---|---|---|
| `X-Gate-Api-Key` | Yes | Pre-shared key matching `GATE_HARDWARE_API_KEY` |
| `Content-Type` | Yes | `application/json` |

**Request body**

```json
{
  "qr_payload": "<raw PhilSys QR string>",
  "gate_id": "<gate UUID>"
}
```

**Response 200 — grant**
```json
{"result": "grant", "ticket_id": "<uuid>", "reason": null}
```

**Response 200 — deny**
```json
{"result": "deny", "ticket_id": null, "reason": "<reason>"}
```

Denial reasons (enum values; JSON string matches the value column):

| Reason | Cause |
|---|---|
| `INVALID_GATE_ID` | `gate_id` is not a valid UUID string |
| `INVALID_GATE_ASSIGNMENT` | No active `gate_assignment` for this gate |
| `IDENTITY_NOT_VERIFIED` | QR empty/invalid, or MOSIP did not verify the identity |
| `SERVER_TIMEOUT` | MOSIP/transport error (`MOSIPUnavailableError`) |
| `LINK_NOT_FOUND` | No `event_ticket_link` for this identity hash and event |
| `TICKET_NOT_FOUND` | No ticket row for the resolved link |
| `TICKET_ALREADY_USED` | Ticket already `USED` (including race on grant) |
| `INTERNAL_SERVER_ERROR` | Unhandled error in the verify pipeline (rare) |

**Response 401** — missing or invalid `X-Gate-Api-Key` (target contract)

---

### `POST /dashboard/tickets/issue`

Verifies a PhilSys QR payload and issues an event ticket for dashboard-originated commands.

**Headers**

| Header | Required | Description |
|---|---|---|
| `X-Internal-Api-Key` | Yes | Matches `INTERNAL_API_KEY` in `.env` |
| `Authorization` | Yes | `Bearer <Supabase access JWT>` — validated with Supabase JWKS (ES256) |
| `X-Trace-Id` | No | Correlation id (e.g. UUID); echoed on the response |
| `Content-Type` | Yes | `application/json` |

**Request body**

```json
{
  "qr_payload": "<raw PhilSys QR string>",
  "event_id": "<event UUID>"
}
```

**Response 201 — issued**
```json
{
  "ticket_id": "<uuid>",
  "link_id": "<uuid>",
  "status": "UNUSED",
  "created_at": "<ISO timestamp>"
}
```

**Response 400** — identity verification failed
```json
{"detail":"identity_not_verified"}
```

**Response 404** — event not found
```json
{"detail":"event_not_found"}
```

**Response 409** — ticket already issued for this identity and event
```json
{"detail":"ticket_already_issued"}
```

**Response 401** — missing or invalid internal key and/or bearer

## MOSIP Credentials

`RealMOSIPAdapter` (the default in production) calls the MOSIP IDA testbed; it does **not** fall back to a stub. You need **all** of the following.

1. Place credential files in `credentials/` (sibling to `app/` — see `credentials/README.md`):
   - `pdec_ida_partner.pem` — IDA partner encryption certificate
   - `keystore.p12` — key store (used for both encryption and signing)
   - `keystore-signed.p12` — signing key store

2. Set MOSIP variables in `.env`:

   ```
   MOSIP_PARTNER_ID=your-partner-id
   MOSIP_PARTNER_APIKEY=your-partner-apikey
   MOSIP_PARTNER_MISP_LK=your-misp-lk
   MOSIP_KEYSTORE_PASSWORD=your-keystore-password
   MOSIP_IDA_DOMAIN_URI=https://api-internal.pdec.mosip.net
   MOSIP_IDA_URL=https://api-internal.pdec.mosip.net/idauthentication/v1
   ```

The server requires WireGuard VPN access to the MOSIP network in production.

## HMAC Pepper

`HMAC_PEPPER` is used by `hash_uin()` to produce the `link_hash` stored in `event_ticket_link`. The same pepper must be set in the web app's `.env.local`.

> **Warning:** If `HMAC_PEPPER` is ever rotated, all existing `link_hash` values in the database become unmatchable. A full re-hash migration is required before any gate can grant access again. Plan pepper rotation carefully.

## Deployment (Railway)

1. Push to a GitHub repo
2. Create a new Railway project → connect the repo → set root directory to `apps/gate-server/`
3. Set all environment variables from `.env.example` in the Railway dashboard
4. Deployment is automatic on push — `railway.json` configures the Dockerfile build and health check

Railway uses `GET /health` as the health check path (configured in `railway.json`). The deploy is marked healthy only after the endpoint returns 200.

The `Dockerfile` is based on `python:3.12-slim`. The start command is:

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## CORS

`allow_origins` is set to `[]` in `main.py` — this blocks all browser-origin requests, which is intentional: hardware and the Next.js **server** call gate-server, not the browser. If you ever expose gate-server to browser clients, add the origin to `allow_origins` and extend `allow_headers` (e.g. `Authorization`, `X-Internal-Api-Key`) in `app/main.py`.
