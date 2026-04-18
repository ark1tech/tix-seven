import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getGates, createGate } from "@/lib/db/gates";

const CreateGateSchema = z.object({
  name: z.string().min(1),
  device_id: z.string().min(1),
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

  const body = await request.json();
  const parsed = CreateGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const gate = await createGate({
    name: parsed.data.name,
    device_id: parsed.data.device_id,
    event_id: parsed.data.event_id ?? null,
  });
  return NextResponse.json(gate, { status: 201 });
}
