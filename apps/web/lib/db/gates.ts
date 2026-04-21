import { createClient } from "@/lib/supabase/server";
import type { Gate } from "@tix-seven/types";

export async function getGates(): Promise<Gate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gate")
    .select("gate_id, venue_id, event_id, location, status")
    .order("gate_id", { ascending: true });
  if (error) throw error;
  return data as Gate[];
}

export async function createGate(
  payload: { location: string; event_id?: string | null }
): Promise<Gate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gate")
    .insert({
      location: payload.location,
      event_id: payload.event_id ?? null,
      status: "OFFLINE",
    })
    .select("gate_id, venue_id, event_id, location, status")
    .single();
  if (error) throw error;
  return data as Gate;
}

export async function updateGate(
  id: string,
  payload: Partial<{ location: string; event_id: string | null }>
): Promise<Gate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gate")
    .update(payload)
    .eq("gate_id", id)
    .select("gate_id, venue_id, event_id, location, status")
    .single();
  if (error) throw error;
  return data as Gate;
}

export async function deleteGate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("gate").delete().eq("gate_id", id);
  if (error) throw error;
}
