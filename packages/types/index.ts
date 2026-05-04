/** Aligned with Postgres enums in `public` (gate-server Alembic). */
export type TicketStatus = "UNUSED" | "USED";
export type GateStatus = "ONLINE" | "OFFLINE";
export type LogResult = "GRANTED" | "DENIED" | "TIMEOUT" | "ERROR";

/** `public.event_status` */
export type EventStatus = "SCHEDULED" | "ACTIVE" | "CONCLUDED";

/** `public.assignment_status` */
export type AssignmentStatus = "ACTIVE" | "INACTIVE";

/**
 * `public.denial_reason` enum — matches `app/models/enums.py` `DenialReasonEnum`.
 */
export type DenialReason =
  | "INVALID_GATE_ID"
  | "GATE_OFFLINE"
  | "INVALID_GATE_ASSIGNMENT"
  | "EVENT_NOT_FOUND"
  | "EVENT_CONCLUDED"
  | "EVENT_CANCELLED"
  | "IDENTITY_NOT_VERIFIED"
  | "LINK_NOT_FOUND"
  | "TICKET_NOT_FOUND"
  | "TICKET_ALREADY_USED"
  | "SERVER_TIMEOUT"
  | "INTERNAL_SERVER_ERROR";

/**
 * `start_time` / `end_time` are Postgres `timestamp without time zone` values intended as
 * Philippines (Asia/Manila) wall clock — not UTC instants. Format from API/DB is typically
 * `YYYY-MM-DD HH:mm:ss` (Postgrest may return `T` between date and time).
 */
export interface Event {
  event_id: string;
  venue_id: string;
  venue_name: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
}

/**
 * Dashboard view: `event_id` is derived from active `gate_assignment`, not a `gate` column.
 */
export interface Gate {
  gate_id: string;
  venue_id: string | null;
  event_id: string | null;
  location: string;
  status: GateStatus;
}

export interface Ticket {
  ticket_id: string;
  link_id: string;
  link_hash: string;
  event_id: string;
  status: TicketStatus;
  created_at: string;
  used_at: string | null;
}

/** Row shape for `public.log` (organizer dashboard). */
export interface Log {
  log_id: string;
  event_id: string;
  gate_id: string;
  assignment_id: string;
  ticket_id: string | null;
  result: LogResult;
  /** `public.log.denial_reason` — null when `result === "GRANTED"`. */
  denial_reason: string | null;
  timestamp: string;
}

/**
 * `public.scan_attempt_log` — full verify audit (gate-server); omit from UI unless you query it.
 */
export interface ScanAttemptLog {
  attempt_id: string;
  timestamp: string;
  gate_id_raw: string;
  gate_id: string | null;
  event_id: string | null;
  assignment_id: string | null;
  ticket_id: string | null;
  result: LogResult;
  denial_reason: string | null;
  error_code: string | null;
}

export interface EventStats {
  sold: number;
  scanned: number;
  denied: number;
}

/** Result of gate-server `POST /tickets/issue` (registration). */
export interface IssuedTicket {
  ticket_id: string;
  link_id: string;
  status: "UNUSED";
  created_at: string;
}

/** PhilSys National ID QR payload (scanned data). */
export interface PhilsysPayload {
  uin: string;
  name: string;
  dob: string;
  location1: string;
  location3: string;
  zone: string;
  postal_code: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
}

/** UI metadata for rendering PhilSys payload fields. */
export const PHILSYS_PAYLOAD_FIELDS: Array<{
  key: keyof PhilsysPayload;
  label: string;
}> = [
  { key: "uin", label: "UIN" },
  { key: "name", label: "Full Name" },
  { key: "dob", label: "Date of Birth" },
  { key: "location1", label: "City/Province" },
  { key: "location3", label: "District/Region" },
  { key: "zone", label: "Zone" },
  { key: "postal_code", label: "Postal Code" },
  { key: "address_line1", label: "Address Line 1" },
  { key: "address_line2", label: "Address Line 2" },
  { key: "address_line3", label: "Address Line 3" },
];
