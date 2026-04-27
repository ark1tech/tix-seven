import { NextResponse } from "next/server";
import { z } from "zod";
import { phtEventTimestampZ } from "@/lib/datetime-pht";
import { createClient } from "@/lib/supabase/server";
import { getEvents, createEvent } from "@/lib/db/events";

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

  const body = await request.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await createEvent(parsed.data);
  return NextResponse.json(event, { status: 201 });
}
