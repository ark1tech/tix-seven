"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { issueTicket } from "@/lib/gate-server/client";
import { createClient } from "@/lib/supabase/server";

export async function issueTicketAction(eventId: string, qrPayload: string, stubMosip: boolean = false) {
  const traceId = randomUUID();
  const payloadBytes = new TextEncoder().encode(qrPayload).length;
  console.info(
    "[ticket-issue] browser->web ingress trace_id=%s event_id=%s qr_payload_bytes=%s",
    traceId,
    eventId,
    payloadBytes,
  );

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    console.warn(
      "[ticket-issue] web auth_failed trace_id=%s event_id=%s reason=invalid_user detail=%s",
      traceId,
      eventId,
      userError?.message ?? "no_user",
    );
    return { ok: false as const, error: "unauthorized" as const };
  }
  console.info(
    "[ticket-issue] web auth_user trace_id=%s event_id=%s user_id=%s",
    traceId,
    eventId,
    user.id,
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    console.warn(
      "[ticket-issue] web auth_failed trace_id=%s event_id=%s reason=missing_access_token",
      traceId,
      eventId,
    );
    return { ok: false as const, error: "unauthorized" as const };
  }
  console.info(
    "[ticket-issue] web auth_token trace_id=%s event_id=%s token_len=%s",
    traceId,
    eventId,
    accessToken.length,
  );

  const result = await issueTicket(accessToken, eventId, qrPayload, traceId, stubMosip);
  if (result.ok) {
    console.info(
      "[ticket-issue] web->browser success trace_id=%s event_id=%s ticket_id=%s",
      traceId,
      eventId,
      result.ticket.ticket_id,
    );
    revalidatePath(`/events/${eventId}`);
  } else {
    console.warn(
      "[ticket-issue] web->browser failure trace_id=%s event_id=%s error=%s",
      traceId,
      eventId,
      result.error,
    );
  }
  return result;
}
