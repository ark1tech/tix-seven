# TixSeven

A PhilSys National ID-powered event ticketing and gate verification system.

## Architecture

| Surface | Stack | Deployed To |
|---|---|---|
| Organizer dashboard (web app) | Next.js 16, Supabase, Shadcn | Vercel |
| Database + Auth + Realtime | Supabase (PostgreSQL) | Supabase cloud |
| Gate server | Python FastAPI | Railway |

See [`plans/0418-prd.md`](plans/0418-prd.md) for the full product requirements.

---

## Repository Structure

```
tix-seven/
│
├── apps/
│   ├── web/                   # Next.js organizer dashboard
│   │   ├── app/               # App Router — pages + API routes
│   │   ├── components/        # React components (events, tickets, gates, entry-log, ui)
│   │   ├── lib/               # Runtime modules (db queries, Supabase, crypto, MOSIP, QR scanner)
│   │   ├── supabase/          # DB migrations + seed SQL
│   │   ├── public/
│   │   ├── proxy.ts           # Supabase auth middleware helper
│   │   ├── next.config.ts
│   │   ├── components.json    # Shadcn config
│   │   └── package.json       # @tix-seven/web
│   │
│   └── gate-server/           # Python FastAPI gate service
│       ├── app/
│       │   ├── adapters/      # MOSIP + Supabase adapters
│       │   ├── core/          # Config + HMAC crypto
│       │   ├── models/        # Pydantic schemas
│       │   ├── routers/       # /health, /verify, /tickets/issue, /dashboard/tickets/issue
│       │   ├── services/      # VerificationService
│       │   └── main.py
│       ├── tests/
│       ├── Dockerfile
│       ├── railway.json
│       └── requirements.txt
│
├── packages/
│   └── types/                 # Shared domain type contracts (TypeScript)
│       └── index.ts           # Event, Ticket, Gate, EntryLog, enums
│
└── plans/                     # PRD and architecture docs
```

### Key design notes

- **`packages/types`** is the shared TypeScript contract for the organizer dashboard. Table row shapes and enums follow **Postgres** / gate-server Alembic (`public.log`, `public.denial_reason`, etc.). API-only Pydantic types (e.g. `VerifyRequest`) live in `apps/gate-server/app/models/schemas.py`. Import shared types as `@tix-seven/types` (see `apps/web/tsconfig.json` paths).
- **No build orchestrator.** Each app is independent — run them from their own directories. The `apps/` + `packages/` layout is convention, not a toolchain requirement.
- **`apps/web/lib/`** is web-app-only infrastructure. Nothing in `lib/` is shareable because every module is tied to Next.js server APIs (`cookies()`), Node.js builtins (`crypto`), or browser APIs (camera).

---

## Local Development

### Web App

```bash
cd apps/web
cp .env.local.example .env.local   # Supabase, HMAC_PEPPER (see gate-server README), gate-server URL + keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

Create an organizer account in your Supabase dashboard under **Authentication → Users**.

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. **Apply the `public` schema** using gate-server Alembic (source of truth):
   ```bash
   cd apps/gate-server
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   # Set DATABASE_URL to your Supabase Postgres connection string (e.g. pooler URL + ssl)
   alembic upgrade head
   ```
3. **Apply web-only Supabase migrations** (grants, `mock` schema, etc.): see [apps/web/supabase/README.md](apps/web/supabase/README.md) — run the remaining files in `apps/web/supabase/migrations/` in order (after step 2).
4. Optional mock seed: `apps/web/supabase/mock_seed.sql` (debug mock mode only).
5. Enable Realtime for **`log`**: **Supabase dashboard → Realtime → Tables → `log` → Enable**

Run `scripts/verify-alembic-head.sh` to confirm Alembic head matches the repo.

### Gate Server

```bash
cd apps/gate-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn app.main:app --reload --port 8000
```

---

## Environment Variables

Hybrid ticket issue and gate verification split **hardware** credentials from **dashboard / server-to-server** credentials. See **`docs/handoffs/2026-04-27-nextjs-db-commands-fastapi-migration.md`** for rollout, rollback, and the inventory of **event/gate write paths** still using Next.js `lib/db` (to be migrated to FastAPI).

### Web App — `apps/web/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `HMAC_PEPPER` | Shared secret for UIN hashing (`openssl rand -hex 32`); must match gate-server |
| `GATE_SERVER_URL` | Base URL of the FastAPI gate-server (no trailing slash required) |
| `GATE_SERVER_INTERNAL_API_KEY` | Matches gate-server `INTERNAL_API_KEY` (or legacy `GATE_API_KEY` when gate-server has no split internal key); sent as `X-Internal-Api-Key` on `POST /dashboard/tickets/issue` |
| `GATE_SERVER_API_KEY` | **Temporary:** used only when `GATE_SERVER_INTERNAL_API_KEY` is unset; same value as gate-server `GATE_API_KEY`; still sent as `X-Internal-Api-Key` to the **dashboard** issue route (not `X-Gate-Api-Key`) |

### Gate Server — `apps/gate-server/.env`

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) |
| `SUPABASE_JWKS_URL` | Optional JWKS override for bearer verification; defaults to `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_EXPECTED_ISS` / `SUPABASE_JWT_EXPECTED_AUD` | Optional JWT claim checks; defaults: iss = `<SUPABASE_URL>/auth/v1`, aud = `authenticated` |
| `HMAC_PEPPER` | Must match the web app value exactly |
| `INTERNAL_API_KEY` | Trusted backend key for `X-Internal-Api-Key` on `POST /dashboard/tickets/issue`; if unset, `GATE_API_KEY` is used as the effective internal secret during migration |
| `GATE_HARDWARE_API_KEY` | ESP8266 `X-Gate-Api-Key` for `POST /verify`; if unset, `GATE_API_KEY` is accepted for `/verify` during migration |
| `GATE_API_KEY` | **Temporary:** legacy `POST /tickets/issue` (`X-Gate-Api-Key`); also the fallback when split keys are omitted |

### API surfaces (summary)

| Route | Caller | Auth |
|---|---|---|
| `POST /dashboard/tickets/issue` | Organizer dashboard (Next.js server action) | `Authorization: Bearer` + `X-Internal-Api-Key`; optional `X-Trace-Id` (echoed on response) |
| `POST /verify` (gate-server) | ESP8266 | `X-Gate-Api-Key` → `GATE_HARDWARE_API_KEY` (or legacy `GATE_API_KEY` when the hardware key is not configured) |
| `POST /tickets/issue` (gate-server, legacy) | Temporary compatibility callers | `X-Gate-Api-Key` → `GATE_API_KEY` |

Missing or invalid auth on gate-server should return **401** under the target contract.

### Safe rollout order

1. Configure and deploy **gate-server** with `INTERNAL_API_KEY`, `GATE_HARDWARE_API_KEY`, and JWKS-based bearer verification (derived from `SUPABASE_URL` or `SUPABASE_JWKS_URL`), and keep **`GATE_API_KEY`** for legacy clients.
2. Configure and deploy **web** with **`GATE_SERVER_INTERNAL_API_KEY`** (and fallback `GATE_SERVER_API_KEY` if needed).
3. Validate hardware scans and dashboard issue end-to-end, then retire the legacy single key.

---

## What's Implemented vs TODO

### Implemented

- Supabase browser + server clients with SSR cookie handling
- Auth middleware (protected routes, redirect to `/login`)
- HMAC-SHA256 UIN hashing (web app + gate server)
- All Supabase database query functions (`lib/db/`)
- Supabase Realtime subscription for live entry log
- QRScanner interface + CameraAdapter (`@zxing/browser`)
- MOSIP adapter interface + stub (TypeScript + Python)
- All API routes with request validation and response shapes
- All dashboard pages and component shells
- FastAPI app with CORS, health endpoint, API key auth
- DB migration + seed SQL
- Gate server Dockerfile + Railway config

### TODO

- `apps/gate-server/app/services/verification.py` — DB queries inside `VerificationService`
- `apps/gate-server/app/adapters/mosip.py` — replace `StubMOSIPAdapter` with real MOSIP SDK
- Dashboard UI — fill component shells with actual Shadcn layouts
- Sign-out server action in dashboard layout
- Error boundaries and loading states on all pages

---

## Deployment

### Web App → Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set **Root Directory** → `apps/web`
4. Set environment variables from `apps/web/.env.local.example`

### Gate Server → Railway

1. Push to GitHub
2. Create Railway project
3. Set **Root Directory** → `apps/gate-server`
4. Set environment variables from `apps/gate-server/.env.example`
5. Railway uses `apps/gate-server/railway.json` automatically
