import { createClient } from "@/lib/supabase/server";
import type { Venue } from "@tix-seven/types";

export async function getVenues(): Promise<Venue[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("venue")
        .select("venue_id, name")
        .order("name", { ascending: true });

    if (error) throw error;

    return (data ?? []) as Venue[];
}

export async function getVenue(id: string): Promise<Venue> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("venue")
        .select("venue_id, name")
        .eq("venue_id", id)
        .single();

    if (error) throw error;

    return data as Venue;
}
