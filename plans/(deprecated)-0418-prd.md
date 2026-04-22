# TixSeven — Product Requirements Document

**Date:** 2026-04-18
**Status:** Approved
**Author:** RK Mañago

---

## Problem Statement

Event organizers in the Philippines face two compounding problems: ticket fraud and scalping. Physical and digital tickets are trivially transferable, making them easy to counterfeit, resell at inflated prices, or bulk-hoard by bad actors. At the point of entry, gate staff have no reliable way to verify that the person presenting a ticket is the legitimate purchaser. Identity checks are manual, slow, and inconsistent.

For attendees, the experience is fragmented — they must manage physical tickets, mobile apps, internet connectivity at high-density venues, and risk losing their sole means of entry.

## Solution

TixSeven is a National ID-powered ticket holding and verification system. Each ticket is cryptographically bound to a single attendee's PhilSys Unique Identification Number (UIN), extracted from their government-issued National ID QR code via MOSIP signature verification. At the gate, the attendee presents their PhilSys ID, which is scanned and verified in real time — no separate ticket required.

The system consists of three surfaces:

- **(A) Ticketing Platform** — where attendees register a ticket against their verified identity. Payments are mocked; PhilSys QR scanning is real (browser camera, modular adapter).
- **(B) Organizer Dashboard** — where event organizers create events, manage ticket inventory, monitor live entry, and configure gate hardware. This is the primary build focus.
- **(C) Gate Server** — a Python FastAPI service (barebones scaffolding only) that receives QR payloads from ESP8266 hardware, invokes MOSIP verification, queries the ticket database, and returns grant/deny decisions.

---

## Goals

- Establish a scalper-resistant ticketing model by anchoring tickets to verified government identities
- Give organizers a live, real-time view of gate activity during events
- Abstract hardware and MOSIP dependencies behind clean interfaces so real implementations can be swapped in without restructuring
- Deploy all three surfaces to cloud infrastructure (Vercel, Supabase, Railway)

## Non-Goals

- Real payment processing (mocked for MVP)
- Multi-organizer tenancy (single shared admin login for MVP)
- Native mobile app
- Concrete MOSIP SDK integration in the gate server (stubbed adapter only)
- Seat mapping or venue floor plan visualization
- Attendee-facing account portal
- Refund or ticket transfer flows

---

## User Personas

### Event Organizer (Admin)
The sole authenticated user of the dashboard. Creates and manages events, issues tickets on behalf of attendees (standing in for the ticketing platform during demos), monitors gate activity in real time, and registers gate hardware.

### Event Attendee
Not a system user — interacts only at the point of ticket purchase (presents PhilSys ID for QR scan) and at the gate (presents PhilSys ID to the scanner). Has no dashboard access.

### Gate Hardware (ESP8266)
Not a human persona, but a system actor. Posts raw PhilSys QR payloads to the gate server and receives grant/deny commands in response.

---

## User Stories

### Authentication
1. As an organizer, I want to log in with an email and password, so that I can access the dashboard securely.
2. As an organizer, I want to remain logged in across browser sessions, so that I don't have to re-authenticate every time.
3. As an organizer, I want to log out, so that unauthorized users cannot access my dashboard on a shared device.

### Events
4. As an organizer, I want to see a list of all events I've created, so that I can manage them from a central view.
5. As an organizer, I want to create a new event with a name, date, venue, and capacity, so that I can set up the ticketing infrastructure before sales begin.
6. As an organizer, I want to edit an existing event's details, so that I can correct mistakes or update information.
7. As an organizer, I want to see how many tickets have been sold and how many remain, so that I can gauge inventory at a glance.
8. As an organizer, I want to see how many attendees have been scanned in for an event, so that I can monitor attendance in real time.
9. As an organizer, I want to see how many scan attempts were denied for an event, so that I can identify potential fraud or confusion at the gate.

### Ticket Registry (within Event Detail)
10. As an organizer, I want to see all tickets issued for an event in a table, so that I can audit the full registry.
11. As an organizer, I want each ticket row to show its Ticket ID, UIN hash, tier (VIP/GA), seat, status (unused/used), and purchase timestamp, so that I have complete ticket metadata.
12. As an organizer, I want to issue a new ticket for an event by scanning an attendee's PhilSys QR code with the browser camera, so that I can register an attendee's identity against the event.
13. As an organizer, I want the system to verify the PhilSys QR cryptographic signature via MOSIP before issuing a ticket, so that only legitimate government-issued IDs are accepted.
14. As an organizer, I want the system to HMAC the verified UIN before storing it, so that raw identity data is never persisted in the database.
15. As an organizer, I want to select a ticket tier (VIP or General Admission) when issuing a ticket, so that access tiers are correctly recorded.
16. As an organizer, I want seat assignment to be automatically assigned from pre-seeded mock data, so that the ticket record is complete without manual input.
17. As an organizer, I want to see a mock payment confirmation step after a ticket is issued, so that the purchase flow is represented end-to-end.
18. As an organizer, I want to be prevented from issuing a second ticket for the same UIN at the same event, so that one-ticket-per-identity is enforced.

### Entry Log (Live Feed)
19. As an organizer, I want to see a live feed of all scan attempts for an event, so that I can monitor gate activity in real time during the event.
20. As an organizer, I want each entry log row to show the timestamp, result (grant/deny), and denial reason, so that I can understand why any given scan was rejected.
21. As an organizer, I want new scan attempts to appear in the entry log instantly without refreshing the page, so that the feed is genuinely real-time.
22. As an organizer, I want denied scans to be visually distinguished from granted scans in the log, so that I can spot problems at a glance.
23. As an organizer, I want to see the specific denial reason (Invalid ID / No Ticket / Already Used / Wrong Event) for each denied scan, so that I can take appropriate action.
24. As an organizer, I want the entry log to be filterable by result (all / granted / denied), so that I can focus on problem scans.

### Gate Management
25. As an organizer, I want to register a new gate device by providing a name and device ID, so that I can track which hardware is assigned to which event.
26. As an organizer, I want to assign a registered gate to a specific event, so that the gate server knows which ticket pool to query.
27. As an organizer, I want to reassign a gate from one event to another, so that hardware can be reused across events.
28. As an organizer, I want to see all registered gates and their current event assignments, so that I can audit my hardware configuration.
29. As an organizer, I want to deregister a gate, so that stale hardware entries don't accumulate.

### QR Scanner
30. As an organizer, I want the browser to activate my device camera to scan a PhilSys QR code, so that I can issue tickets without manual data entry.
31. As an organizer, I want the scanner to automatically detect and decode the QR code when it comes into frame, so that scanning is fast and hands-free.
32. As an organizer, I want to be notified immediately if the scanned QR fails MOSIP verification, so that I can ask the attendee for a valid ID.
33. As an organizer, I want the QR scanner to be swappable with a hardware GM861S scanner without restructuring the application, so that the system can be upgraded to dedicated hardware at any time.

---

## Implementation Decisions

### Architecture
- **Monorepo:** Next.js (App Router) for the web application. Frontend and API routes coexist in a single repository deployed to Vercel.
- **Database / Auth / Realtime:** Supabase cloud. PostgreSQL for storage, Supabase Auth for organizer login, Supabase Realtime for live entry log updates.
- **Gate Server:** Separate Python FastAPI project, deployed to Railway. Barebones scaffolding only — no concrete MOSIP or actuation implementation.

### Data Model

#### `events`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | |
| date | timestamptz | |
| venue | text | |
| capacity | integer | Total ticket quota |
| created_at | timestamptz | |

#### `tickets`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Ticket ID |
| event_id | uuid (FK → events) | |
| uin_hash | text | HMAC-SHA256(HMAC_PEPPER, UIN) |
| tier | enum (vip, ga) | |
| seat | text | Seeded with mock data |
| status | enum (unused, used) | Default: unused |
| purchase_timestamp | timestamptz | |
| created_at | timestamptz | |

Unique constraint: `(event_id, uin_hash)` — one ticket per identity per event.

#### `gates`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| event_id | uuid (FK → events, nullable) | Null if unassigned |
| name | text | Human-readable label |
| device_id | text | Unique hardware identifier |
| created_at | timestamptz | |

#### `entry_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| gate_id | uuid (FK → gates) | |
| event_id | uuid (FK → events) | |
| uin_hash | text | HMAC of the scanned UIN |
| result | enum (grant, deny) | |
| denial_reason | enum (invalid_id, no_ticket, already_used, wrong_event, null) | Null on grant |
| timestamp | timestamptz | |

### UIN Hashing
- Algorithm: HMAC-SHA256
- Key: `HMAC_PEPPER` environment variable (shared between web app and gate server)
- The raw UIN is never stored or logged anywhere in the system
- The gate server hashes the incoming verified UIN before querying the `tickets` table

### Authentication
- Supabase Auth, email + password
- Single shared organizer account for MVP
- Session managed via Supabase client SDK
- Protected routes via Next.js middleware checking session token

### QR Scanner Module
A `QRScanner` abstraction with two methods: `start(onDecode: (payload: string) => void)` and `stop()`.

Two adapters:
- **CameraAdapter** (default): Uses `html5-qrcode` or `@zxing/browser` to scan via device camera
- **SerialAdapter** (future): Reads decoded string from GM861S via Web Serial API or HID input

The Issue Ticket form depends only on the `QRScanner` interface, not a concrete adapter. The adapter is injected at the component level.

### MOSIP Adapter
A stub adapter in both the web app and gate server with a clear `TODO` boundary:

**Web app (TypeScript):**
```
interface MOSIPAdapter {
  verify(qrPayload: string): Promise<{ verified: boolean; uin: string | null }>
}
```
The stub implementation returns `{ verified: true, uin: "<extracted-from-payload>" }` for any input during development.

**Gate server (Python):**
```
class MOSIPAdapter(Protocol):
    def verify(self, qr_payload: str) -> VerificationResult: ...
```
The stub implementation returns a mock-verified result. The real MOSIP Python SDK call replaces this.

### Gate Server API Contract (Barebones)

`POST /verify`
- **Request body:** `{ "qr_payload": string, "gate_id": string }`
- **Response (grant):** `{ "result": "grant", "ticket_id": string }`
- **Response (deny):** `{ "result": "deny", "reason": "invalid_id" | "no_ticket" | "already_used" | "wrong_event" }`
- **Auth:** Gate server authenticates to Supabase using `SUPABASE_SERVICE_ROLE_KEY` env var. ESP8266 authenticates to gate server via a shared `GATE_API_KEY` header.

`GET /health`
- Returns `{ "status": "ok" }` — used by Railway health checks.

### Supabase Realtime
The organizer dashboard subscribes to `INSERT` events on the `entry_logs` table filtered by `event_id`. New rows pushed by the gate server appear in the live feed immediately without polling.

### Environment Variables

**Web app (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
HMAC_PEPPER=
```

**Gate server (.env):**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
HMAC_PEPPER=
GATE_API_KEY=
```

### Deployment
| Surface | Platform |
|---|---|
| Next.js web app | Vercel |
| Database + Auth + Realtime | Supabase cloud |
| Gate server | Railway |

---

## Testing Decisions

### What makes a good test
Tests should verify external behavior through public interfaces only — not implementation details. A test that breaks when you rename an internal function (but the behavior is unchanged) is a bad test. A test that breaks when you change what the system actually does is a good test.

### Modules to test

**`MOSIPAdapter` (stub)**
- Given any QR payload, returns a verified result with a non-null UIN
- Given a malformed payload (future real adapter), returns `{ verified: false, uin: null }`
- Interface contract: both stub and real adapter satisfy the same type signature

**`QRScanner` adapters**
- `CameraAdapter.start()` invokes `onDecode` when a valid QR string is decoded
- `SerialAdapter.start()` invokes `onDecode` when a valid serial string is received
- Both adapters call `stop()` cleanly without throwing

**Ticket issuance API route**
- Given a valid verified UIN, creates a ticket record with correct HMAC hash, status `unused`, and correct event binding
- Given a duplicate UIN for the same event, returns a conflict error
- Given a failed MOSIP verification, returns a rejection error
- HMAC output is deterministic: same UIN + same pepper always yields the same hash

**Gate server `/verify` endpoint**
- Given a valid QR payload for a gate assigned to an event, and an unused ticket for that UIN, returns `grant` and marks ticket as `used`
- Given a valid QR payload but no ticket for that event, returns `deny` with reason `no_ticket`
- Given a valid QR payload for an already-used ticket, returns `deny` with reason `already_used`
- Given a gate assigned to Event A but a ticket for Event B, returns `deny` with reason `wrong_event`
- Given an invalid QR payload (MOSIP verification fails), returns `deny` with reason `invalid_id`

**Entry log Realtime subscription**
- When a new row is inserted into `entry_logs`, the subscription callback fires with the correct payload
- The live feed component renders the new row without a page reload

---

## Out of Scope

- Real payment processing
- Multi-organizer tenancy / Row Level Security per organizer
- Attendee self-service portal (ticket lookup, transfer, refund)
- Concrete MOSIP Python SDK integration in the gate server
- Physical gate actuation logic (servo, LED) in any web surface
- Venue floor plan or seat map visualization
- Mobile native app
- Offline mode for the organizer dashboard
- Email/SMS notifications to attendees
- Bulk ticket import via CSV

---

## Further Notes

- **HMAC pepper rotation:** If the pepper must be rotated, all existing `uin_hash` values in `tickets` and `entry_logs` become unmatchable. A migration strategy (re-hash all records) must be planned before any rotation. Document this risk clearly in the gate server README.
- **MOSIP trust anchors:** For real PhilSys QR verification, the MOSIP instance must hold PSA's root certificates. The testbed instance may not have these. This is the highest-risk external dependency — confirm with the team before implementing the real adapter.
- **GM861S swap path:** To switch from browser camera to GM861S, implement `SerialAdapter` using the Web Serial API (Chrome/Edge only) or configure the GM861S in HID keyboard-emulation mode and point its output at a focused hidden input that triggers `onDecode`. No other application code changes.
- **Gate API key:** The `GATE_API_KEY` shared between ESP8266 and the gate server must be provisioned per-deployment. Document the key rotation process.
- **Seat mock data:** Seat assignments are pre-seeded strings (e.g., "A1", "B12", "VIP-03"). They are assigned sequentially at ticket issuance time from a pool per event/tier. No real seat selection UI is required for MVP.
