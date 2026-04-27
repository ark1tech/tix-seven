import type { Event } from "@tix-seven/types";
import { requireGateServerUrl, resolveInternalApiKey } from "./internal";

export type EventError =
  | "unauthorized"
  | "forbidden"
  | "event_not_found"
  | "validation_error"
  | "internal_server_error";

export type CreateEventResult =
  | { ok: true; event: Event }
  | { ok: false; error: EventError };

export type UpdateEventResult =
  | { ok: true; event: Event }
  | { ok: false; error: EventError };

function parseBodyDetail(body: unknown): string | undefined {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return undefined;
}

function mapErrorResponse(
  res: Response,
  body: unknown,
  traceId: string,
  route: string,
): EventError {
  const detail = parseBodyDetail(body);
  if (res.status === 401) return "unauthorized";
  if (res.status === 403) return "forbidden";
  if (res.status === 404 && detail === "event_not_found") return "event_not_found";
  if (res.status === 400) return "validation_error";
  console.error(
    "[events] gate->web unexpected_status trace_id=%s route=%s status_code=%s",
    traceId,
    route,
    res.status,
  );
  return "internal_server_error";
}

export async function createEvent(
  accessToken: string,
  body: {
    name: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    capacity: number;
  },
  traceId: string,
): Promise<CreateEventResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const internalKey = resolveInternalApiKey();
  const route = "/dashboard/events";

  console.info(
    "[events] web->gate request trace_id=%s route=POST %s",
    traceId,
    route,
  );

  let res: Response;
  try {
    res = await fetch(`${base}${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Internal-Api-Key": internalKey,
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify(body),
    });
  } catch {
    console.error(
      "[events] web->gate transport_error trace_id=%s route=POST %s",
      traceId,
      route,
    );
    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 201) {
    const event = (await res.json()) as Event;
    return { ok: true, event };
  }

  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { ok: false, error: mapErrorResponse(res, resBody, traceId, `POST ${route}`) };
}

export async function updateEvent(
  accessToken: string,
  eventId: string,
  body: Partial<{
    name: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    capacity: number;
  }>,
  traceId: string,
): Promise<UpdateEventResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const internalKey = resolveInternalApiKey();
  const route = `/dashboard/events/${eventId}`;

  console.info(
    "[events] web->gate request trace_id=%s route=PATCH %s",
    traceId,
    route,
  );

  let res: Response;
  try {
    res = await fetch(`${base}${route}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Internal-Api-Key": internalKey,
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify(body),
    });
  } catch {
    console.error(
      "[events] web->gate transport_error trace_id=%s route=PATCH %s",
      traceId,
      route,
    );
    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 200) {
    const event = (await res.json()) as Event;
    return { ok: true, event };
  }

  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { ok: false, error: mapErrorResponse(res, resBody, traceId, `PATCH ${route}`) };
}
