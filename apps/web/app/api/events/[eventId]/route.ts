import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEvent, updateEvent } from "@/lib/db/events";

const UpdateEventSchema = z.object({
  name: z.string().min(1).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
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

  const { eventId } = await params;
  const body = await request.json();
  const parsed = UpdateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await updateEvent(eventId, parsed.data);
  return NextResponse.json(event);
}
