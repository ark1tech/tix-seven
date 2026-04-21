import { createClient } from "@/lib/supabase/server";
import type { Ticket } from "@tix-seven/types";

export async function getTickets(eventId: string): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_ticket_link")
    .select("link_id, link_hash, event_id, ticket(ticket_id, status, created_at, used_at)")
    .eq("event_id", eventId);
  if (error) throw error;

  return (data ?? []).flatMap((row: any) => {
    const t = row.ticket;
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
