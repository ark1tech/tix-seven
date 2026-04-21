export type TicketStatus = "UNUSED" | "USED";
export type GateStatus = "ONLINE" | "OFFLINE";
export type LogResult = "GRANTED" | "DENIED" | "TIMEOUT" | "ERROR";

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
  reason: string | null;
  timestamp: string;
}

export interface EventStats {
  sold: number;
  scanned: number;
  denied: number;
}
