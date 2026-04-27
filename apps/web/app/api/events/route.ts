import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { phtEventTimestampZ } from "@/lib/datetime-pht";
import { createClient } from "@/lib/supabase/server";
import { getEvents } from "@/lib/db/events";
import { createEvent } from "@/lib/gate-server/events";

const CreateEventSchema = z.object({
  name: z.string().min(1),
  start_time: phtEventTimestampZ,
  end_time: phtEventTimestampZ,
  venue_name: z.string().min(1),
  capacity: z.number().int().positive(),
});

export async function GET() {
  // TODO: verify session before returning data
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await getEvents();
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  // TODO: verify session before creating
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const traceId = randomUUID();
  const result = await createEvent(accessToken, parsed.data, traceId);
  if (!result.ok) {
    const status =
      result.error === "unauthorized" ? 401
      : result.error === "forbidden" ? 403
      : result.error === "validation_error" ? 400
      : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.event, { status: 201 });
}
