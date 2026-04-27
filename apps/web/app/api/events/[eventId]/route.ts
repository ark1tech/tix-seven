import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { phtEventTimestampZ } from "@/lib/datetime-pht";
import { createClient } from "@/lib/supabase/server";
import { getEvent } from "@/lib/db/events";
import { updateEvent } from "@/lib/gate-server/events";

const UpdateEventSchema = z.object({
  name: z.string().min(1).optional(),
  start_time: phtEventTimestampZ.optional(),
  end_time: phtEventTimestampZ.optional(),
  venue_name: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;
  const event = await getEvent(eventId);
  return NextResponse.json(event);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;
  const body = await request.json();
  const parsed = UpdateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const traceId = randomUUID();
  const result = await updateEvent(accessToken, eventId, parsed.data, traceId);
  if (!result.ok) {
    const status =
      result.error === "unauthorized" ? 401
      : result.error === "forbidden" ? 403
      : result.error === "event_not_found" ? 404
      : result.error === "validation_error" ? 400
      : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.event);
}
