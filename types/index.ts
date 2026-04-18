export type TicketTier = "vip" | "ga";
export type TicketStatus = "unused" | "used";
export type ScanResult = "grant" | "deny";
export type DenialReason =
  | "invalid_id"
  | "no_ticket"
  | "already_used"
  | "wrong_event";

export interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  capacity: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  event_id: string;
  uin_hash: string;
  tier: TicketTier;
  seat: string;
  status: TicketStatus;
  purchase_timestamp: string;
  created_at: string;
}

export interface Gate {
  id: string;
  event_id: string | null;
  name: string;
  device_id: string;
  created_at: string;
}

export interface EntryLog {
  id: string;
  gate_id: string;
  event_id: string;
  uin_hash: string;
  result: ScanResult;
  denial_reason: DenialReason | null;
  timestamp: string;
}

export interface EventStats {
  sold: number;
  scanned: number;
  denied: number;
}
