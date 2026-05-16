"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mockScan } from "@/lib/gate-server/client";

export interface Gate {
  gate_id: string;
  location: string;
}

interface GateAssignmentRow {
  gate_id: string;
  gate: Array<{
    location: string;
  }>;
}

export async function getAssignedGatesAction(eventId: string): Promise<Gate[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("gate_assignment")
    .select(`
      gate_id,
      gate:gate_id (
        location
      )
    `)
    .eq("event_id", eventId)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("[mock-scan] failed to fetch gates:", error);
    return [];
  }

  return (data as GateAssignmentRow[]).map((d) => ({
    gate_id: d.gate_id,
    location: d.gate[0].location,
  }));
}

export async function mockScanAction(gateId: string, qrPayload: string, eventId: string, stubMosip: boolean = false) {
  if (process.env.NEXT_PUBLIC_DEBUG_TOOLS !== "true") {
    return { ok: false as const, error: "debug_tools_disabled" };
  }

  const traceId = randomUUID();
  console.info(
    "[mock-scan] browser->web ingress trace_id=%s gate_id=%s payload_len=%s stubbed=%s",
    traceId,
    gateId,
    qrPayload.length,
    stubMosip
  );

  const result = await mockScan(gateId, qrPayload, traceId, stubMosip);

  if (result.ok) {
    console.info(
      "[mock-scan] web->browser success trace_id=%s result=%s ticket_id=%s",
      traceId,
      result.result,
      result.ticket_id ?? "-",
    );
    // Revalidate the entry log since a scan occurred
    revalidatePath(`/events/${eventId}/entry-log`);
    revalidatePath(`/events/${eventId}`);
  } else {
    console.warn(
      "[mock-scan] web->browser failure trace_id=%s error=%s",
      traceId,
      result.error,
    );
  }

  return result;
}
