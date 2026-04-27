import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateGate, deleteGate } from "@/lib/gate-server/gates";

const UpdateGateSchema = z.object({
  location: z.string().min(1).optional(),
  event_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gateId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gateId } = await params;
  const body = await request.json();
  const parsed = UpdateGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const traceId = randomUUID();
  const result = await updateGate(accessToken, gateId, parsed.data, traceId);
  if (!result.ok) {
    const status =
      result.error === "unauthorized" ? 401
      : result.error === "forbidden" ? 403
      : result.error === "gate_not_found" ? 404
      : result.error === "validation_error" ? 400
      : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.gate);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ gateId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gateId } = await params;
  const traceId = randomUUID();
  const result = await deleteGate(accessToken, gateId, traceId);
  if (!result.ok) {
    const status =
      result.error === "unauthorized" ? 401
      : result.error === "forbidden" ? 403
      : result.error === "gate_not_found" ? 404
      : result.error === "gate_in_use" ? 409
      : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return new NextResponse(null, { status: 204 });
}
