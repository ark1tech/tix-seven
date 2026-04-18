import { createClient } from "@/lib/supabase/server";
import type { EntryLog } from "@tix-seven/types";

export async function getEntryLogs(eventId: string): Promise<EntryLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entry_logs")
    .select("*")
    .eq("event_id", eventId)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return data;
}
