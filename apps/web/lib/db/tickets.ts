import { createClient } from "@/lib/supabase/server";
import type { Ticket } from "@tix-seven/types";

type TicketJoinRow = {
  link_id: string;
  link_hash: string;
  event_id: string;
  ticket:
    | Pick<Ticket, "ticket_id" | "status" | "created_at" | "used_at">
    | Pick<Ticket, "ticket_id" | "status" | "created_at" | "used_at">[]
    | null;
};

export async function getTickets(eventId: string): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_ticket_link")
    .select("link_id, link_hash, event_id, ticket(ticket_id, status, created_at, used_at)")
    .eq("event_id", eventId);
  if (error) throw error;

  return ((data ?? []) as unknown as TicketJoinRow[]).flatMap((row) => {
    const t = Array.isArray(row.ticket) ? row.ticket[0] : row.ticket;
    if (!t) return [];
    return [{
      ticket_id: t.ticket_id,
      link_id: row.link_id,
      link_hash: row.link_hash,
      event_id: row.event_id,
      status: t.status,
      created_at: t.created_at,
      used_at: t.used_at,
    }];
  });
}
