import { createClient } from "@/lib/supabase/server";
import type { Event } from "@tix-seven/types";

type EventRow = Omit<Event, "venue_name"> & {
  venue: { name: string } | { name: string }[] | null;
};


function toEvent(row: EventRow): Event {
  const venue = Array.isArray(row.venue) ? row.venue[0] : row.venue;
  return {
    event_id: row.event_id,
    venue_id: row.venue_id,
    venue_name: venue?.name ?? "",
    name: row.name,
    start_time: row.start_time,
    end_time: row.end_time,
    capacity: row.capacity,
  };
}

export async function getEvents(): Promise<Event[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event")
    .select("event_id, venue_id, name, start_time, end_time, capacity, venue(name)")
    .order("start_time", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as EventRow[]).map(toEvent);
}

export async function getEvent(id: string): Promise<Event> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event")
    .select("event_id, venue_id, name, start_time, end_time, capacity, venue(name)")
    .eq("event_id", id)
    .single();
  if (error) throw error;
  return toEvent(data as unknown as EventRow);
}

