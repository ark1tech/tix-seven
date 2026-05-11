import { createClient } from "@/lib/supabase/server";

export interface Venue {
  venue_id: string;
  name: string;
}

export async function getVenues(): Promise<Venue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venue")
    .select("venue_id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Venue[];
}
