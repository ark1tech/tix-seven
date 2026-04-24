"use server";

import { revalidatePath } from "next/cache";

import { issueTicket } from "@/lib/gate-server/client";

export async function issueTicketAction(eventId: string, qrPayload: string) {
  const result = await issueTicket(eventId, qrPayload);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}
