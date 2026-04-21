"use client";

import { createClient } from "@/lib/supabase/client";
import type { Log } from "@tix-seven/types";

export function subscribeToEntryLogs(
  eventId: string,
  onInsert: (log: Log) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`log:${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "log",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        onInsert(payload.new as Log);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
