import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateGate, deleteGate } from "@/lib/db/gates";

const UpdateGateSchema = z.object({
  name: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  event_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gateId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gateId } = await params;
  const body = await request.json();
  const parsed = UpdateGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const gate = await updateGate(gateId, parsed.data);
  return NextResponse.json(gate);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ gateId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gateId } = await params;
  await deleteGate(gateId);
  return new NextResponse(null, { status: 204 });
}
