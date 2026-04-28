"use client";

import { createClient } from "@/lib/supabase/client";
import type { Log } from "@tix-seven/types";

/**
 * Subscribe to entry logs for a given event.
 *
 * Two complementary listeners are registered:
 *
 * 1. **broadcast / log_insert** – fired by the DB trigger `broadcast_log()`
 *    via `realtime.send()`. This is public (anon-friendly) and fast.
 *
 * 2. **postgres_changes / INSERT** – direct WAL listener. Reliable fallback
 *    for authenticated users, ensuring no logs are missed even if the
 *    broadcast topic has issues.
 */
export function subscribeToEntryLogs(
  eventId: string,
  onInsert: (log: Log) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`log:${eventId}`)
    // Primary path: public broadcast
    .on(
      "broadcast",
      { event: "log_insert" },
      (payload) => {
        onInsert(payload.payload as Log);
      }
    )
    // Fallback path: postgres_changes
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
