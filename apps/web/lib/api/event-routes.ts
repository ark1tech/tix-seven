import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { phtEventTimestampZ } from "@/lib/datetime-pht";
import {
  createEvent,
  eventErrorHttpStatus,
  formatEventUserMessage,
  transitionEventStatus,
  updateEvent,
  type CreateEventBody,
  type EventMutationResult,
  type TransitionStatusBody,
  type UpdateEventBody,
} from "@/lib/gate-server/events";

const createEventBodySchema = z.object({
  name: z.string().trim().min(1, "Event name is required"),
  venue_id: z.string().uuid("Select a valid venue"),
  start_time: phtEventTimestampZ,
  end_time: phtEventTimestampZ,
  capacity: z.coerce.number().int().gt(0, "Capacity must be at least 1"),
});

const updateEventBodySchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required").optional(),
    venue_id: z.string().uuid("Select a valid venue").optional(),
    start_time: phtEventTimestampZ.optional(),
    end_time: phtEventTimestampZ.optional(),
    capacity: z.coerce
      .number()
      .int()
      .gt(0, "Capacity must be at least 1")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update the event",
  });

const transitionStatusBodySchema = z.object({
  status: z.enum(["ACTIVE", "CONCLUDED", "CANCELLED"]),
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
          error: formatEventUserMessage({
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

export function parseCreateEventBody(
  json: unknown,
): { ok: true; body: CreateEventBody } | { ok: false; response: NextResponse } {
  const parsed = createEventBodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid event details";

    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 422 }),
    };
  }

  const { name, venue_id, start_time, end_time, capacity } = parsed.data;

  if (end_time <= start_time) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: formatEventUserMessage({
            ok: false,
            error: "end_time_must_be_after_start_time",
          }),
        },
        { status: 422 },
      ),
    };
  }

  return {
    ok: true,
    body: { name, venue_id, start_time, end_time, capacity },
  };
}

export function parseUpdateEventBody(
  json: unknown,
): { ok: true; body: UpdateEventBody } | { ok: false; response: NextResponse } {
  const parsed = updateEventBodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid event details";

    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 422 }),
    };
  }

  const body = parsed.data;

  if (
    body.start_time !== undefined &&
    body.end_time !== undefined &&
    body.end_time <= body.start_time
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: formatEventUserMessage({
            ok: false,
            error: "end_time_must_be_after_start_time",
          }),
        },
        { status: 422 },
      ),
    };
  }

  return { ok: true, body };
}

export function parseTransitionStatusBody(
  json: unknown,
):
  | { ok: true; body: TransitionStatusBody }
  | { ok: false; response: NextResponse } {
  const parsed = transitionStatusBodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid status";

    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 422 }),
    };
  }

  return { ok: true, body: parsed.data };
}

export function mutationJsonResponse(
  result: EventMutationResult,
  successStatus: number,
): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.event, { status: successStatus });
  }

  return NextResponse.json(
    { error: formatEventUserMessage(result) },
    { status: eventErrorHttpStatus(result.error) },
  );
}

export async function handleCreateEvent(json: unknown): Promise<NextResponse> {
  const auth = await requireRouteAuth();
  if (!auth.ok) return auth.response;

  const bodyParsed = parseCreateEventBody(json);
  if (!bodyParsed.ok) return bodyParsed.response;

  const result = await createEvent(
    auth.accessToken,
    bodyParsed.body,
    auth.traceId,
  );

  return mutationJsonResponse(result, 201);
}

export async function handleUpdateEvent(
  eventId: string,
  json: unknown,
): Promise<NextResponse> {
  const auth = await requireRouteAuth();
  if (!auth.ok) return auth.response;

  const bodyParsed = parseUpdateEventBody(json);
  if (!bodyParsed.ok) return bodyParsed.response;

  const result = await updateEvent(
    auth.accessToken,
    eventId,
    bodyParsed.body,
    auth.traceId,
  );

  return mutationJsonResponse(result, 200);
}

export async function handleTransitionEventStatus(
  eventId: string,
  json: unknown,
): Promise<NextResponse> {
  const auth = await requireRouteAuth();
  if (!auth.ok) return auth.response;

  const bodyParsed = parseTransitionStatusBody(json);
  if (!bodyParsed.ok) return bodyParsed.response;

  const result = await transitionEventStatus(
    auth.accessToken,
    eventId,
    bodyParsed.body,
    auth.traceId,
  );

  return mutationJsonResponse(result, 200);
}
