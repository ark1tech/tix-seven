"use client";

import { createClient } from "@/lib/supabase/client";
import type { Ticket } from "@tix-seven/types";

/**
 * Subscribe to ticket changes for a given event.
 *
 * Two complementary listeners are registered on a single channel:
 *
 * 1. **broadcast / ticket_update** – fired by the DB trigger
 *    `broadcast_enriched_ticket()` via `realtime.send()`.  Carries the full
 *    enriched payload including `link_hash`.  Used for both INSERT and UPDATE.
 *
 * 2. **postgres_changes / UPDATE** – a direct WAL listener on the `ticket`
 *    table filtered to the current event.  Acts as a reliable fallback for
 *    status changes (e.g. USED after scanning) in case the broadcast trigger
 *    silently skips the event (e.g. transient join race on link_hash).
 *    Only `ticket_id`, `status`, and `used_at` are reliably present here;
 *    the callback merges them with existing state via the ?? guard in
 *    TicketTable, so missing link_hash is safe.
 */
export function subscribeToTickets(
  eventId: string,
  onChange: (ticket: Partial<Ticket> & Pick<Ticket, "ticket_id">) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`ticket:${eventId}`)
    // Primary path: enriched broadcast from the DB trigger.
    .on(
      "broadcast",
      { event: "ticket_update" },
      (payload) => {
        onChange(payload.payload as Ticket);
      }
    )
    // Fallback path: postgres_changes UPDATE listener.
    // Guarantees the TicketTable re-renders on status change even if the
    // broadcast trigger's NOT FOUND guard silently drops the event.
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "ticket",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        // payload.new contains the raw ticket row (no link_hash column).
        // Cast to partial so the merge in TicketTable uses ?? to keep the
        // existing link_hash intact.
        onChange(payload.new as Partial<Ticket> & Pick<Ticket, "ticket_id">);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
