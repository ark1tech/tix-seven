import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  createGate,
  deleteGate,
  formatGateUserMessage,
  gateErrorHttpStatus,
  updateGate,
  type CreateGateBody,
  type CreateGateResult,
  type DeleteGateResult,
  type UpdateGateBody,
  type UpdateGateResult,
} from "@/lib/gate-server/gates";

const createGateBodySchema = z.object({
  venue_id: z.string().uuid("Select a valid venue"),
  location: z.string().trim().min(1, "Location is required"),
  event_id: z.string().uuid("Select a valid event").nullable().optional(),
});

const updateGateBodySchema = z
  .object({
    location: z.string().trim().min(1, "Location is required").optional(),
    event_id: z.string().uuid("Select a valid event").nullable().optional(),
    status: z.enum(["ONLINE", "OFFLINE"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update the gate",
  });

export type RouteAuth =
  | { ok: true; accessToken: string; traceId: string }
  | { ok: false; response: NextResponse };

export async function requireRouteAuth(): Promise<RouteAuth> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: formatGateUserMessage({
            ok: false,
            error: "unauthorized",
          }),
        },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    accessToken: session.access_token,
    traceId: randomUUID(),
  };
}

export function parseCreateGateBody(
  json: unknown,
): { ok: true; body: CreateGateBody } | { ok: false; response: NextResponse } {
  const parsed = createGateBodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid gate details";

    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 422 }),
    };
  }

  const { venue_id, location, event_id } = parsed.data;

  return {
    ok: true,
    body: {
      venue_id,
      location,
      event_id: event_id ?? null,
    },
  };
}

export function parseUpdateGateBody(
  json: unknown,
): { ok: true; body: UpdateGateBody } | { ok: false; response: NextResponse } {
  const parsed = updateGateBodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid gate details";

    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 422 }),
    };
  }

  return { ok: true, body: parsed.data };
}

export function createGateJsonResponse(result: CreateGateResult): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.gate, { status: 201 });
  }

  return NextResponse.json(
    { error: formatGateUserMessage(result) },
    { status: gateErrorHttpStatus(result.error) },
  );
}

export function updateGateJsonResponse(result: UpdateGateResult): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.gate, { status: 200 });
  }

  return NextResponse.json(
    { error: formatGateUserMessage(result) },
    { status: gateErrorHttpStatus(result.error) },
  );
}

export function deleteGateJsonResponse(result: DeleteGateResult): NextResponse {
  if (result.ok) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(
    { error: formatGateUserMessage(result) },
    { status: gateErrorHttpStatus(result.error) },
  );
}

export async function handleCreateGate(json: unknown): Promise<NextResponse> {
  const auth = await requireRouteAuth();
  if (!auth.ok) return auth.response;

  const bodyParsed = parseCreateGateBody(json);
  if (!bodyParsed.ok) return bodyParsed.response;

  const result = await createGate(
    auth.accessToken,
    bodyParsed.body,
    auth.traceId,
  );

  return createGateJsonResponse(result);
}

export async function handleUpdateGate(
  gateId: string,
  json: unknown,
): Promise<NextResponse> {
  const auth = await requireRouteAuth();
  if (!auth.ok) return auth.response;

  const bodyParsed = parseUpdateGateBody(json);
  if (!bodyParsed.ok) return bodyParsed.response;

  const result = await updateGate(
    auth.accessToken,
    gateId,
    bodyParsed.body,
    auth.traceId,
  );

  return updateGateJsonResponse(result);
}

export async function handleDeleteGate(gateId: string): Promise<NextResponse> {
  const auth = await requireRouteAuth();
  if (!auth.ok) return auth.response;

  const result = await deleteGate(auth.accessToken, gateId, auth.traceId);

  return deleteGateJsonResponse(result);
}
