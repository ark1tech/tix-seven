# TixSeven Gate Server

Python FastAPI service that receives PhilSys QR payloads from ESP8266 gate hardware and returns grant/deny decisions.

## Status

**Barebones scaffold.** All interfaces and project structure are in place. The following are stubbed and need implementation:

- `app/services/verification.py` — `_get_event_id_for_gate`, `_find_ticket`, `_mark_used`, `_log`
- `app/adapters/mosip.py` — replace `StubMOSIPAdapter` with the real MOSIP SDK adapter
- `app/main.py` — startup health checks (DB, MOSIP reachability)

See `plans/0418-prd.md` for the full spec.

## Local Development

```bash
cd gate-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn app.main:app --reload
```

## API

### `GET /health`
Returns `{ "status": "ok" }`. Used by Railway health checks.

### `POST /verify`
**Headers:** `X-Gate-Api-Key: <GATE_API_KEY>`

**Request:**
```json
{ "qr_payload": "<raw PhilSys QR string>", "gate_id": "<uuid>" }
```

**Response (grant):**
```json
{ "result": "grant", "ticket_id": "<uuid>" }
```

**Response (deny):**
```json
{ "result": "deny", "reason": "invalid_id" | "no_ticket" | "already_used" | "wrong_event" }
```

## Tests

```bash
pytest
```

## Deployment (Railway)

1. Push to a GitHub repo
2. Create a new Railway project, connect the repo, set root directory to `gate-server/`
3. Set environment variables from `.env.example`
4. Railway uses `railway.json` — deploy is automatic on push

## HMAC Pepper Note

`HMAC_PEPPER` must be identical to the value in the web app's `.env.local`. If the pepper is ever rotated, all existing `uin_hash` values in the database become unmatchable — a full re-hash migration is required. Plan carefully before rotating.
