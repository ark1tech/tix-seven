import { createClient } from "@/lib/supabase/server";
import type { Ticket, TicketTier } from "@/types";

export async function getTickets(eventId: string): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("event_id", eventId)
    .order("purchase_timestamp", { ascending: false });
  if (error) throw error;
  return data;
}

export async function issueTicket(payload: {
  eventId: string;
  uinHash: string;
  tier: TicketTier;
}): Promise<Ticket> {
  const supabase = await createClient();

  // Claim the next available seat for this event + tier from the seed pool
  const { data: seat, error: seatError } = await supabase
    .from("seat_pool")
    .select("seat")
    .eq("event_id", payload.eventId)
    .eq("tier", payload.tier)
    .eq("taken", false)
    .order("seat", { ascending: true })
    .limit(1)
    .single();

  if (seatError || !seat) throw new Error("No seats available for this tier");

  // Mark the seat as taken
  await supabase
    .from("seat_pool")
    .update({ taken: true })
    .eq("event_id", payload.eventId)
    .eq("tier", payload.tier)
    .eq("seat", seat.seat);

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      event_id: payload.eventId,
      uin_hash: payload.uinHash,
      tier: payload.tier,
      seat: seat.seat,
      status: "unused",
      purchase_timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markTicketUsed(ticketId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ status: "used" })
    .eq("id", ticketId);
  if (error) throw error;
}
