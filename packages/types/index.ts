export type TicketStatus = "UNUSED" | "USED";
export type GateStatus = "ONLINE" | "OFFLINE";
export type LogResult = "GRANTED" | "DENIED" | "TIMEOUT" | "ERROR";
export type EventStatus = "SCHEDULED" | "ACTIVE" | "CONCLUDED" | "CANCELLED";
export type AssignmentStatus = "ACTIVE" | "INACTIVE";

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

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

/*
One row in the Event List View. Returned by GET /events (gate-server).
`start_time` and `end_time` are Postgres `timestamp without time zone` values.  They represent wall clock times in the Philippines (Asia/Manila timezone), not UTC instants. This means that the same timestamp value corresponds to the same local time regardless of daylight saving time changes or server timezone. Consumers of these fields should treat them as opaque strings for display and comparison purposes, without attempting to interpret them as UTC or convert them to other timezones.
*/
export interface EventSummary {
    event_id: string;
    venue_id: string;
    venue_name: string;
    name: string;
    status: EventStatus;
    start_time: string;
    end_time: string;
    capacity: number;
    admitted_count: number;
}

// Gate row embedded in EventDetail.
export interface AssignedGate {
    gate_id: string;
    location: string;
    status: GateStatus;
    assignment_id: string; // surfaced for support or debug
}


// Full payload for the Event Detail View. Returned by GET /events/:id/detail (gate-server).
export interface EventDetail {
    event_id: string;
    venue_id: string;
    venue_name: string;
    name: string;
    status: EventStatus;
    start_time: string;
    end_time: string;
    capacity: number;
    admitted_count: number;
    assigned_gates: AssignedGate[];
    ticket_summary: TicketSummary;
}

// ---------------------------------------------------------------------------
// Venue
// ---------------------------------------------------------------------------

export interface Venue {
    venue_id: string;
    name: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

// Dashboard view: `event_id` is derived from the active `gate_assignment`, not a column on `gate` itself.
export interface Gate {
    gate_id: string;
    venue_id: string | null;
    event_id: string | null;
    location: string;
    status: GateStatus;
}

// ---------------------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------------------

/*
One row in the Issued Tickets Table.
`link_id` is nullable after Phase-5 cleanup (link deleted, ticket survives for audit).
*/
export interface Ticket {
    ticket_id: string;
    link_id: string | null;
    event_id: string;
    status: TicketStatus;
    created_at: string;
    used_at: string | null;
}

export interface TicketSummary {
    total: number;
    used: number;
    unused: number;
}

export interface TicketListResponse {
    summary: TicketSummary;
    tickets: Ticket[];
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

/*
One row in the Scan Log Table.
Snapshot columns are durable even after gate / event deletion.
*/
export interface Log {
    log_id: string;
    timestamp: string;
    raw_gate_id_snapshot: string;           // always present; collapsed in UI by default
    gate_location_snapshot: string | null;
    result: LogResult;
    denial_reason: DenialReason | null;     // null when result "GRANTED"
    ticket_id: string | null;               // absent on TIMEOUT / ERROR
    ticket_status_snapshot: string | null;
}

export interface DenialReasonCount {
    reason: DenialReason;
    count: number;
}

export interface LogSummary {
    total: number;
    granted: number;
    denied: number;
    timeout_or_error: number;
    denial_breakdown: DenialReasonCount[];
}

export interface LogListResponse {
    summary: LogSummary;
    logs: Log[];
}

// A gate option for the Scan Log filter dropdown.
export interface GateFilterOption {
    gate_id: string;
    location: string;
}

// ---------------------------------------------------------------------------
// Issuance
// ---------------------------------------------------------------------------

// Result of gate-server `POST /tickets/issue` (registration).
export interface IssuedTicket {
    ticket_id: string;
    link_id: string;
    status: "UNUSED";
    created_at: string;
}

// ---------------------------------------------------------------------------
// PhilSys
// ---------------------------------------------------------------------------

// PhilSys National ID QR payload.
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

// UI metadata for rendering PhilSys payload fields.
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
