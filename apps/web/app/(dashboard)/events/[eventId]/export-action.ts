"use server";

import { randomUUID } from "node:crypto";

import { getEntryLogs } from "@/lib/gate-server/entry-logs";
import { getEventDetail } from "@/lib/gate-server/events";
import { getTickets } from "@/lib/gate-server/tickets";
import { createClient } from "@/lib/supabase/server";
import type { ExportRegistry } from "@/lib/export/types";
import type { AssignedGate, Log, Ticket } from "@tix-seven/types";

export type ExportFetchError =
  | "unauthorized"
  | "event_not_found"
  | "fetch_failed";

export type ExportFetchResult =
  | { ok: true; registry: "tickets"; rows: Ticket[] }
  | { ok: true; registry: "gates"; rows: AssignedGate[] }
  | { ok: true; registry: "logs"; rows: Log[] }
  | { ok: false; error: ExportFetchError; detail?: string };

async function resolveAccessToken(): Promise<
  { ok: true; accessToken: string; traceId: string } | { ok: false }
> {
  const traceId = randomUUID();
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return { ok: false };
  }

  return { ok: true, accessToken, traceId };
}

export async function fetchExportDataAction(
  eventId: string,
  registry: ExportRegistry,
): Promise<ExportFetchResult> {
  const auth = await resolveAccessToken();
  if (!auth.ok) {
    return { ok: false, error: "unauthorized" };
  }

  const { accessToken, traceId } = auth;

  if (registry === "tickets") {
    const result = await getTickets(accessToken, eventId, {}, traceId);
    if (!result.ok) {
      if (result.error === "event_not_found") {
        return { ok: false, error: "event_not_found" };
      }
      return {
        ok: false,
        error: "fetch_failed",
        detail: result.error,
      };
    }
    return { ok: true, registry: "tickets", rows: result.data.tickets };
  }

  if (registry === "gates") {
    const result = await getEventDetail(accessToken, eventId, traceId);
    if (!result.ok) {
      if (result.error === "event_not_found") {
        return { ok: false, error: "event_not_found" };
      }
      return {
        ok: false,
        error: "fetch_failed",
        detail: result.error,
      };
    }
    return { ok: true, registry: "gates", rows: result.event.assigned_gates };
  }

  const result = await getEntryLogs(accessToken, eventId, {}, traceId);
  if (!result.ok) {
    if (result.error === "event_not_found") {
      return { ok: false, error: "event_not_found" };
    }
    return {
      ok: false,
      error: "fetch_failed",
      detail: result.error,
    };
  }
  return { ok: true, registry: "logs", rows: result.data.logs };
}
