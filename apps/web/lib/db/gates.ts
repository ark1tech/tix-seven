import { createClient, isMockMode } from "@/lib/supabase/server";
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

async function resolveVenueIdForInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string | null | undefined
): Promise<string> {
  if (eventId) {
    const { data, error } = await supabase
      .from("event")
      .select("venue_id")
      .eq("event_id", eventId)
      .single();
    if (error) throw error;
    return data.venue_id as string;
  }
  const { data, error } = await supabase.from("venue").select("venue_id").limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.venue_id) {
    throw new Error("No venue found. Create a venue or assign this gate to an event.");
  }
  return data.venue_id as string;
}

async function deactivateActiveAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gateId: string,
  nowIso: string
) {
  const { data: actives, error: fetchErr } = await supabase
    .from("gate_assignment")
    .select("assignment_id")
    .eq("gate_id", gateId)
    .eq("status", "ACTIVE");
  if (fetchErr) throw fetchErr;
  for (const row of actives ?? []) {
    const { error } = await supabase
      .from("gate_assignment")
      .update({ status: "INACTIVE", unassigned_at: nowIso })
      .eq("assignment_id", row.assignment_id as string);
    if (error) throw error;
  }
}

async function syncGateVenueToEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gateId: string,
  eventId: string | null
) {
  if (!eventId) return;
  const { data, error } = await supabase
    .from("event")
    .select("venue_id")
    .eq("event_id", eventId)
    .single();
  if (error) throw error;
  const { error: upErr } = await supabase
    .from("gate")
    .update({ venue_id: data.venue_id })
    .eq("gate_id", gateId);
  if (upErr) throw upErr;
}

export async function getGates(): Promise<Gate[]> {
  const mock = await isMockMode();
  const supabase = await createClient();

  if (mock) {
    const { data, error } = await supabase
      .from("gate")
      .select("gate_id, venue_id, event_id, location, status")
      .order("gate_id", { ascending: true });
    if (error) throw error;
    return data as Gate[];
  }

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

export async function createGate(
  payload: { location: string; event_id?: string | null }
): Promise<Gate> {
  const mock = await isMockMode();
  const supabase = await createClient();

  if (mock) {
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

  const venue_id = await resolveVenueIdForInsert(supabase, payload.event_id ?? null);
  const { data: gate, error } = await supabase
    .from("gate")
    .insert({
      location: payload.location,
      venue_id,
      status: "OFFLINE",
    })
    .select(GATE_COLUMNS)
    .single();
  if (error) throw error;

  if (payload.event_id) {
    const now = new Date().toISOString();
    const { error: assignErr } = await supabase.from("gate_assignment").insert({
      gate_id: gate.gate_id,
      event_id: payload.event_id,
      status: "ACTIVE",
      assigned_at: now,
    });
    if (assignErr) throw assignErr;
  }

  return {
    ...gate,
    event_id: payload.event_id ?? null,
  } as Gate;
}

export async function updateGate(
  id: string,
  payload: Partial<{ location: string; event_id: string | null }>
): Promise<Gate> {
  const mock = await isMockMode();
  const supabase = await createClient();

  if (mock) {
    const { data, error } = await supabase
      .from("gate")
      .update(payload)
      .eq("gate_id", id)
      .select("gate_id, venue_id, event_id, location, status")
      .single();
    if (error) throw error;
    return data as Gate;
  }

  const gateUpdate: Record<string, string> = {};
  if (payload.location !== undefined) gateUpdate.location = payload.location;
  if (Object.keys(gateUpdate).length > 0) {
    const { error } = await supabase.from("gate").update(gateUpdate).eq("gate_id", id);
    if (error) throw error;
  }

  if (payload.event_id !== undefined) {
    const now = new Date().toISOString();
    const { data: actives, error: fetchErr } = await supabase
      .from("gate_assignment")
      .select("assignment_id, event_id")
      .eq("gate_id", id)
      .eq("status", "ACTIVE");
    if (fetchErr) throw fetchErr;
    const currentEventId =
      actives && actives.length > 0 ? (actives[0].event_id as string | null) : null;

    if (payload.event_id !== currentEventId) {
      await deactivateActiveAssignments(supabase, id, now);
      if (payload.event_id) {
        const { error: insErr } = await supabase.from("gate_assignment").insert({
          gate_id: id,
          event_id: payload.event_id,
          status: "ACTIVE",
          assigned_at: now,
        });
        if (insErr) throw insErr;
      }
      await syncGateVenueToEvent(supabase, id, payload.event_id);
    }
  }

  const { data: gate, error } = await supabase
    .from("gate")
    .select(GATE_COLUMNS)
    .eq("gate_id", id)
    .single();
  if (error) throw error;
  const eventByGate = await activeEventIdByGateId(supabase);
  return { ...gate, event_id: eventByGate.get(id) ?? null } as Gate;
}

export async function deleteGate(id: string): Promise<void> {
  const mock = await isMockMode();
  const supabase = await createClient();

  if (!mock) {
    const { error: aErr } = await supabase.from("gate_assignment").delete().eq("gate_id", id);
    if (aErr) throw aErr;
  }
  const { error } = await supabase.from("gate").delete().eq("gate_id", id);
  if (error) throw error;
}
