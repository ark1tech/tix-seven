import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getGates } from "@/lib/db/gates";
import { createGate } from "@/lib/gate-server/gates";

const CreateGateSchema = z.object({
  venue_id: z.string().uuid(),
  location: z.string().min(1),
  event_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gates = await getGates();
  return NextResponse.json(gates);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const traceId = randomUUID();
  const result = await createGate(
    accessToken,
    { 
      venue_id: parsed.data.venue_id,
      location: parsed.data.location, 
      event_id: parsed.data.event_id ?? null 
    },
    traceId,
  );
  if (!result.ok) {
    const status =
      result.error === "unauthorized" ? 401
      : result.error === "forbidden" ? 403
      : result.error === "validation_error" ? 400
      : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.gate, { status: 201 });
}
