"use client";

import { createClient } from "@/lib/supabase/client";
import type { Ticket } from "@tix-seven/types";

export function subscribeToTickets(
  eventId: string,
  onChange: (ticket: Ticket) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`ticket:${eventId}`)
    .on(
      "broadcast",
      { event: "ticket_update" },
      (payload) => {
        onChange(payload.payload as Ticket);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
