import { createClient } from "@/lib/supabase/server";
import type { Log } from "@tix-seven/types";

const LOG_SELECT =
  "log_id, event_id, gate_id, assignment_id, ticket_id, result, denial_reason, timestamp";

export async function getEntryLogs(eventId: string): Promise<Log[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log")
    .select(LOG_SELECT)
    .eq("event_id", eventId)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Log[];
}
