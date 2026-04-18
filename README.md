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
│       │   ├── routers/       # /health + /verify endpoints
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

- **`packages/types`** is the single source of truth for domain types shared across `apps/web`. It mirrors the Pydantic schemas in `apps/gate-server/app/models/schemas.py`. Import it as `@tix-seven/types` inside the web app (mapped via `tsconfig.json` paths).
- **No build orchestrator.** Each app is independent — run them from their own directories. The `apps/` + `packages/` layout is convention, not a toolchain requirement.
- **`apps/web/lib/`** is web-app-only infrastructure. Nothing in `lib/` is shareable because every module is tied to Next.js server APIs (`cookies()`), Node.js builtins (`crypto`), or browser APIs (camera).

---

## Local Development

### Web App

```bash
cd apps/web
cp .env.local.example .env.local   # fill in Supabase credentials + HMAC_PEPPER
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

Create an organizer account in your Supabase dashboard under **Authentication → Users**.

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in the Supabase SQL editor:
   ```
   apps/web/supabase/migrations/20260418000000_initial_schema.sql
   ```
3. Run the seed data:
   ```
   apps/web/supabase/seed.sql
   ```
4. Enable Realtime for `entry_logs`: **Supabase dashboard → Realtime → Tables → entry_logs → Enable**

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

### Web App — `apps/web/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `HMAC_PEPPER` | Shared secret for UIN hashing (`openssl rand -hex 32`) |

### Gate Server — `apps/gate-server/.env`

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) |
| `HMAC_PEPPER` | Must match the web app value exactly |
| `GATE_API_KEY` | Shared secret sent by ESP8266 in `X-Gate-Api-Key` header |

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
