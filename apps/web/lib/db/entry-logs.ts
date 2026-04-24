import { createClient, isMockMode } from "@/lib/supabase/server";
import type { Log, LogResult } from "@tix-seven/types";

export async function getEntryLogs(eventId: string): Promise<Log[]> {
  const supabase = await createClient();
  const mock = await isMockMode();

  if (mock) {
    const { data, error } = await supabase
      .from("log")
      .select("log_id, event_id, gate_id, ticket_id, result, reason, timestamp")
      .eq("event_id", eventId)
      .order("timestamp", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(
      (row: {
        log_id: string;
        event_id: string;
        gate_id: string;
        ticket_id: string | null;
        result: string;
        reason: string | null;
        timestamp: string;
      }): Log => ({
        log_id: row.log_id,
        event_id: row.event_id,
        gate_id: row.gate_id,
        ticket_id: row.ticket_id,
        result: row.result as LogResult,
        denial_reason: row.reason,
        timestamp: row.timestamp,
      })
    );
  }

  const { data, error } = await supabase
    .from("log")
    .select("log_id, event_id, gate_id, ticket_id, result, denial_reason, timestamp")
    .eq("event_id", eventId)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Log[];
}
