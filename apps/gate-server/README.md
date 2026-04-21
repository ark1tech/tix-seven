# TixSeven Gate Server

Python FastAPI service that receives PhilSys QR payloads from ESP8266 gate hardware and returns grant/deny decisions in real time.

## Overview

```
ESP8266 gate  ──POST /verify──▶  gate-server  ──▶  MOSIP IDA (QR verification)
                                      │
                                      ▼
                               Supabase / Postgres
                      (gates, tickets, event_ticket_links, logs)
```

A physical gate device scans a PhilSys QR code, sends the raw payload to this server with a pre-shared API key, and receives either `{"result":"grant"}` or `{"result":"deny","reason":"..."}`. The server verifies the QR against MOSIP's Identity Authentication API, checks that the attendee holds a valid unused ticket for the correct event, atomically marks the ticket used, and writes an audit log entry.

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
| `DATABASE_URL` | Direct Postgres URI. Get from Supabase Dashboard → Project Settings → Database → URI. Use port **5432** (not the pooler). |
| `HMAC_PEPPER` | 32-byte hex secret. **Must match `HMAC_PEPPER` in the web app `.env.local`.** Generate: `openssl rand -hex 32` |
| `GATE_API_KEY` | Pre-shared key sent by ESP8266 in `X-Gate-Api-Key`. Generate: `openssl rand -hex 32` |

MOSIP variables (`MOSIP_PARTNER_ID`, `MOSIP_PARTNER_APIKEY`, etc.) are optional for local development — the service runs with a stub adapter when they are absent. See [MOSIP Credentials](#mosip-credentials) below.

### 4. Run database migrations

```bash
# Still inside apps/gate-server with venv active
alembic upgrade head
```

This creates all tables (`venue`, `event`, `event_ticket_link`, `gate`, `ticket`, `log`) on the target database. Alembic reads `DATABASE_URL` from `.env` automatically.

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
- `POST /verify` rejects requests missing the API key (403)
- Every denial branch: `invalid_id`, `no_ticket`, `already_used`, `wrong_event`
- Grant path: marks ticket used, returns `ticket_id`

## Manual Smoke Tests

Make sure the server is running (`python -m uvicorn app.main:app --reload`) and substitute your `GATE_API_KEY` value.

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

Expected: `403`

### Deny — invalid QR (empty payload)

```bash
curl -X POST http://127.0.0.1:8000/verify \
  -H "Content-Type: application/json" \
  -H "X-Gate-Api-Key: YOUR_GATE_API_KEY" \
  -d '{"qr_payload":"","gate_id":"11111111-1111-1111-1111-111111111111"}'
```

Expected:
```json
{"result":"deny","ticket_id":null,"reason":"invalid_id"}
```

### Deny — gate not assigned to an event

```bash
curl -X POST http://127.0.0.1:8000/verify \
  -H "Content-Type: application/json" \
  -H "X-Gate-Api-Key: YOUR_GATE_API_KEY" \
  -d '{"qr_payload":"1234567890123456|2000-01-01","gate_id":"<valid-gate-uuid>"}'
```

With a real DB but no `event_id` set on the gate row, expected:
```json
{"result":"deny","ticket_id":null,"reason":"wrong_event"}
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
│   │   ├── log.py            # Log ORM model
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── ticket.py         # Ticket ORM model
│   │   └── venue.py          # Venue ORM model
│   ├── routers/
│   │   ├── health.py         # GET /health
│   │   └── verify.py         # POST /verify (auth + DI wiring)
│   ├── services/
│   │   └── verification.py   # VerificationService — core business logic
│   └── main.py               # FastAPI app, middleware, router includes
├── alembic/                  # Alembic migration environment
│   └── versions/             # Migration scripts
├── tests/
│   ├── conftest.py           # Fixtures: FakeSession, StubMOSIPAdapter, TestClient
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
| `X-Gate-Api-Key` | Yes | Pre-shared key matching `GATE_API_KEY` in `.env` |
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

Denial reasons:

| Reason | Cause |
|---|---|
| `invalid_id` | QR payload is empty, malformed, or MOSIP verification failed |
| `wrong_event` | `gate_id` is not a valid UUID or the gate has no event assigned |
| `no_ticket` | No ticket found linking this attendee's UIN hash to this event |
| `already_used` | Ticket exists but has already been scanned (status = `USED`) |

**Response 403** — missing or invalid API key

## MOSIP Credentials

The `RealMOSIPAdapter` requires credential files and environment variables to call the MOSIP IDA endpoint. For local development these are not needed — the `StubMOSIPAdapter` is used automatically when MOSIP env vars are absent.

When integrating with a real MOSIP environment:

1. Place credential files in `credentials/` (next to `app/`):
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

`allow_origins` is set to `[]` in `main.py` — this blocks all browser-origin requests, which is intentional since only ESP8266 firmware calls this server. If a web dashboard ever needs direct access, add the dashboard origin to the `allow_origins` list in `app/main.py`.
