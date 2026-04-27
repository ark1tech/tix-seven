import { createClient } from "@/lib/supabase/server";
import type { Gate } from "@tix-seven/types";

const GATE_COLUMNS = "gate_id, venue_id, location, status";

async function activeEventIdByGateId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("gate_assignment")
    .select("gate_id, event_id")
    .eq("status", "ACTIVE");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.gate_id as string, row.event_id as string);
  }
  return map;
}

export async function getGates(): Promise<Gate[]> {
  const supabase = await createClient();
  const { data: gates, error } = await supabase
    .from("gate")
    .select(GATE_COLUMNS)
    .order("gate_id", { ascending: true });
  if (error) throw error;
  const eventByGate = await activeEventIdByGateId(supabase);
  return (gates ?? []).map((g) => ({
    ...g,
    event_id: eventByGate.get(g.gate_id as string) ?? null,
  })) as Gate[];
}
