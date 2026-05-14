import { createClient } from "@/lib/supabase/server";
import type { Gate } from "@tix-seven/types";

const GATE_COLUMNS = "gate_id, venue_id, location, status";

async function buildActiveEventMap(
    supabase: Awaited<ReturnType<typeof createClient>>,
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
        .order("location", { ascending: true });

    if (error) throw error;

    const eventByGate = await buildActiveEventMap(supabase);

    return (gates ?? []).map((g) => ({
        ...g,
        event_id: eventByGate.get(g.gate_id as string) ?? null,
    })) as Gate[];
}

export async function getGate(id: string): Promise<Gate> {
    const supabase = await createClient();

    const { data: gate, error } = await supabase
        .from("gate")
        .select(GATE_COLUMNS)
        .eq("gate_id", id)
        .single();

    if (error) throw error;

    const { data: assignment } = await supabase
        .from("gate_assignment")
        .select("event_id")
        .eq("gate_id", id)
        .eq("status", "ACTIVE")
        .maybeSingle();

    return {
        ...gate,
        event_id: assignment?.event_id ?? null,
    } as Gate;
}
