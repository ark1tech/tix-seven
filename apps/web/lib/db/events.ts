import { createClient } from "@/lib/supabase/server";
import type { Event } from "@tix-seven/types";

type EventRow = Omit<Event, "venue_name"> & {
  venue: { name: string } | { name: string }[] | null;
};

type EventUpdate = Partial<{
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  venue_id: string;
}>;

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

export async function createEvent(
  payload: { name: string; start_time: string; end_time: string; venue_name: string; capacity: number }
): Promise<Event> {
  const supabase = await createClient();

  const { data: venue, error: venueError } = await supabase
    .from("venue")
    .upsert({ name: payload.venue_name }, { onConflict: "name", ignoreDuplicates: false })
    .select("venue_id")
    .single();
  if (venueError) throw venueError;

  const { data, error } = await supabase
    .from("event")
    .insert({
      venue_id: venue.venue_id,
      name: payload.name,
      start_time: payload.start_time,
      end_time: payload.end_time,
      capacity: payload.capacity,
    })
    .select("event_id, venue_id, name, start_time, end_time, capacity, venue(name)")
    .single();
  if (error) throw error;
  return toEvent(data as unknown as EventRow);
}

export async function updateEvent(
  id: string,
  payload: Partial<{ name: string; start_time: string; end_time: string; venue_name: string; capacity: number }>
): Promise<Event> {
  const supabase = await createClient();

  const { venue_name, ...eventFields } = payload;
  const update: EventUpdate = { ...eventFields };

  if (venue_name !== undefined) {
    const { data: venue, error: venueError } = await supabase
      .from("venue")
      .upsert({ name: venue_name }, { onConflict: "name", ignoreDuplicates: false })
      .select("venue_id")
      .single();
    if (venueError) throw venueError;
    update.venue_id = venue.venue_id;
  }

  const { data, error } = await supabase
    .from("event")
    .update(update)
    .eq("event_id", id)
    .select("event_id, venue_id, name, start_time, end_time, capacity, venue(name)")
    .single();
  if (error) throw error;
  return toEvent(data as unknown as EventRow);
}
