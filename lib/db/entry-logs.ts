import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { EntryLog } from "@/types";

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

/**
 * Subscribe to new entry log rows for a specific event via Supabase Realtime.
 * Returns an unsubscribe function — call it on component unmount.
 *
 * Usage (in a Client Component):
 *   useEffect(() => {
 *     const unsub = subscribeToEntryLogs(eventId, (log) => setLogs(prev => [log, ...prev]));
 *     return unsub;
 *   }, [eventId]);
 */
export function subscribeToEntryLogs(
  eventId: string,
  onInsert: (log: EntryLog) => void
): () => void {
  const supabase = createBrowserClient();

  const channel = supabase
    .channel(`entry_logs:${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "entry_logs",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        onInsert(payload.new as EntryLog);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
