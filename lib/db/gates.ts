import { createClient } from "@/lib/supabase/server";
import type { Gate } from "@/types";

export async function getGates(): Promise<Gate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gates")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createGate(
  payload: Omit<Gate, "id" | "created_at">
): Promise<Gate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gates")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGate(
  id: string,
  payload: Partial<Omit<Gate, "id" | "created_at">>
): Promise<Gate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gates")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("gates").delete().eq("id", id);
  if (error) throw error;
}
