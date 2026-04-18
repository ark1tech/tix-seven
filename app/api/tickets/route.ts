import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { StubMOSIPAdapter } from "@/lib/mosip/stub-adapter";
import { hashUIN } from "@/lib/crypto/hmac";
import { issueTicket } from "@/lib/db/tickets";

const IssueTicketSchema = z.object({
  eventId: z.string().uuid(),
  qrPayload: z.string().min(1),
  tier: z.enum(["vip", "ga"]),
});

const mosip = new StubMOSIPAdapter();

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = IssueTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { eventId, qrPayload, tier } = parsed.data;

  // Step 1: Verify PhilSys QR via MOSIP
  // TODO: swap StubMOSIPAdapter for the real adapter once MOSIP endpoint is confirmed
  const verification = await mosip.verify(qrPayload);
  if (!verification.verified || !verification.uin) {
    return NextResponse.json(
      { error: "PhilSys ID could not be verified" },
      { status: 422 }
    );
  }

  // Step 2: Hash the verified UIN
  const uinHash = await hashUIN(verification.uin);

  // Step 3: Create ticket record (enforces unique constraint on event_id + uin_hash)
  // TODO: handle duplicate UIN error (unique constraint violation) gracefully
  const ticket = await issueTicket({ eventId, uinHash, tier });

  // Step 4: Mock payment confirmation — no real payment gateway
  // TODO: integrate payment provider here if needed

  return NextResponse.json(
    { ticket, paymentStatus: "mock_confirmed" },
    { status: 201 }
  );
}
