import { handleDeleteGate, handleUpdateGate } from "@/lib/api/gate-routes";
import { isUuid } from "@/lib/utils";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ gateId: string }> },
) {
  const { gateId } = await context.params;

  if (!isUuid(gateId)) {
    return Response.json({ error: "Invalid gate ID." }, { status: 400 });
  }

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  return handleUpdateGate(gateId, json);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ gateId: string }> },
) {
  const { gateId } = await context.params;

  if (!isUuid(gateId)) {
    return Response.json({ error: "Invalid gate ID." }, { status: 400 });
  }

  return handleDeleteGate(gateId);
}
