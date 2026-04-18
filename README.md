# TixSeven

A PhilSys National ID-powered event ticketing and gate verification system.

## Architecture

| Surface | Stack | Deployed To |
|---|---|---|
| Web app (ticketing + organizer dashboard) | Next.js 15, Supabase, Shadcn | Vercel |
| Database + Auth + Realtime | Supabase (PostgreSQL) | Supabase cloud |
| Gate server | Python FastAPI | Railway |

See `plans/0418-prd.md` for the full product requirements.

## Monorepo Structure

```
tix-seven/
├── app/               # Next.js App Router pages + API routes
├── components/        # React components (events, tickets, entry-log, gates)
├── lib/               # Supabase clients, MOSIP adapter, QR scanner, DB queries
├── types/             # Shared TypeScript types
├── supabase/          # DB migrations + seed data
├── gate-server/       # Python FastAPI gate server (barebones)
└── plans/             # PRD and architecture docs
```

## Local Development

### Web App

```bash
cp .env.local.example .env.local   # fill in Supabase URL, anon key, HMAC_PEPPER
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

Create an organizer account in your Supabase dashboard under **Authentication → Users**.

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in the Supabase SQL editor:
   ```
   supabase/migrations/20260418000000_initial_schema.sql
   ```
3. Run the seed data:
   ```
   supabase/seed.sql
   ```
4. Enable Realtime for `entry_logs`: **Supabase dashboard → Realtime → Tables → entry_logs → Enable**

### Gate Server

```bash
cd gate-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

### Web App (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `HMAC_PEPPER` | Shared secret for UIN hashing (generate: `openssl rand -hex 32`) |

### Gate Server (`.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) |
| `HMAC_PEPPER` | Must match web app value exactly |
| `GATE_API_KEY` | Shared secret sent by ESP8266 in `X-Gate-Api-Key` header |

## What's Implemented vs TODO

### Implemented (infrastructure)
- Supabase browser + server clients with SSR cookie handling
- Auth middleware (protected routes, redirect to `/login`)
- HMAC-SHA256 UIN hashing (web app + gate server)
- All database query functions
- Supabase Realtime subscription for live entry log
- QRScanner interface + CameraAdapter (`@zxing/browser`)
- MOSIP adapter interface + stub (both TS and Python)
- All API routes (request validation, response shapes)
- All dashboard pages and component shells
- FastAPI app with CORS, health endpoint, API key auth
- DB migration + seed SQL
- Gate server Dockerfile + Railway config

### TODO (feature implementation)
- `app/services/verification.py` — DB queries inside `VerificationService`
- `app/adapters/mosip.py` — replace `StubMOSIPAdapter` with real MOSIP SDK
- Dashboard UI — fill in component shells with actual Shadcn layouts
- Sign-out server action in dashboard layout
- Error boundaries and loading states on all pages

## Deployment

### Web App → Vercel
1. Push to GitHub
2. Import project in Vercel
3. Set environment variables from `.env.local.example`

### Gate Server → Railway
1. Push to GitHub
2. Create Railway project, set root directory to `gate-server/`
3. Set environment variables from `gate-server/.env.example`
4. Railway uses `gate-server/railway.json` automatically
