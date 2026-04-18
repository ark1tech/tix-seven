"use client";

import { createClient } from "@/lib/supabase/client";
import type { EntryLog } from "@tix-seven/types";

/**
 * Subscribe to new entry log rows for a specific event via Supabase Realtime.
 * Client-safe — uses the browser Supabase client (no next/headers dependency).
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToEntryLogs(
  eventId: string,
  onInsert: (log: EntryLog) => void,
  schema = "public"
): () => void {
  const supabase = createClient(schema);

  const channel = supabase
    .channel(`entry_logs:${eventId}:${schema}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema,
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
