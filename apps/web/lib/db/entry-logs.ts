import { createClient } from "@/lib/supabase/server";
import type { Log } from "@tix-seven/types";

export async function getEntryLogs(eventId: string): Promise<Log[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log")
    .select("log_id, event_id, gate_id, ticket_id, result, reason, timestamp")
    .eq("event_id", eventId)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return data as Log[];
}
