export type TicketStatus = "UNUSED" | "USED";
export type GateStatus = "ONLINE" | "OFFLINE";
export type LogResult = "GRANTED" | "DENIED" | "TIMEOUT" | "ERROR";

/** Aligned to `public.denial_reason` in Postgres. Mock data may use other short strings. */
export type DenialReason =
  | "IDENTITY_NOT_VERIFIED"
  | "LINK_NOT_FOUND"
  | "TICKET_NOT_FOUND"
  | "TICKET_ALREADY_USED"
  | "SERVER_TIMEOUT"
  | "INTERNAL_SERVER_ERROR";

export interface Event {
  event_id: string;
  venue_id: string;
  venue_name: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
}

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

export interface Log {
  log_id: string;
  event_id: string;
  gate_id: string;
  ticket_id: string | null;
  result: LogResult;
  /** `public.log.denial_reason` (enum) or `mock.log.reason` (free text) in debug */
  denial_reason: string | null;
  timestamp: string;
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
