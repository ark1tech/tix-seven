import type { EventDetail, EventSummary } from "@tix-seven/types";
import {
  formatGateErrorHint,
  logTransportError,
  makeHeaders,
  parseBodyDetail,
  parseResponseBody,
  parseValidationDetail,
  requireGateServerUrl,
} from "../internal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventError =
  | "unauthorized"
  | "forbidden"
  | "event_not_found"
  | "venue_not_found"
  | "event_concluded"
  | "event_cancelled"
  | "event_has_gate_assignments"
  | "invalid_status_transition"
  | "end_time_must_be_after_start_time"
  | "only_scheduled_or_cancelled_events_can_be_deleted"
  | "event_has_dependents"
  | "validation_error"
  | "internal_server_error";

export type EventListResult =
  | { ok: true; events: EventSummary[] }
  | { ok: false; error: EventError };

export type EventDetailResult =
  | { ok: true; event: EventDetail }
  | { ok: false; error: EventError };

export type EventMutationFailure = {
  ok: false;
  error: EventError;
  detail?: string;
};

export type EventMutationResult =
  | { ok: true; event: EventSummary }
  | EventMutationFailure;

export type EventDeleteResult = { ok: true } | EventMutationFailure;

export type MappedEventError = { error: EventError; detail?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failure(error: EventError, detail?: string): EventMutationFailure {
  return detail === undefined
    ? { ok: false, error }
    : { ok: false, error, detail };
}

export function eventErrorHttpStatus(error: EventError): number {
  if (error === "unauthorized") return 401;
  if (error === "forbidden") return 403;
  if (error === "event_not_found" || error === "venue_not_found") return 404;
  if (
    error === "event_concluded" ||
    error === "event_cancelled" ||
    error === "event_has_gate_assignments" ||
    error === "invalid_status_transition" ||
    error === "only_scheduled_or_cancelled_events_can_be_deleted" ||
    error === "event_has_dependents"
  ) {
    return 409;
  }
  if (
    error === "end_time_must_be_after_start_time" ||
    error === "validation_error"
  ) {
    return 422;
  }
  return 500;
}

export function formatEventUserMessage(f: EventMutationFailure): string {
  const primary: Record<EventError, string> = {
    unauthorized:
      "You're not signed in or your session has expired. Please sign in again and try saving the event.",
    forbidden:
      "Your account doesn't have permission to change this event. Contact an admin if you think this is a mistake.",
    event_not_found:
      "We couldn't find this event. It may have been deleted. Refresh the page or return to the events list.",
    venue_not_found:
      "The selected venue no longer exists. Choose another venue and try again.",
    event_concluded:
      "This event has already concluded and can no longer be edited.",
    event_cancelled: "This event was cancelled and can no longer be edited.",
    event_has_gate_assignments:
      "This event has gate assignments, so its venue cannot be changed. Remove gate assignments first or keep the current venue.",
    invalid_status_transition:
      "That status change isn't allowed for this event's current state.",
    end_time_must_be_after_start_time:
      "End date and time must be after the start date and time.",
    only_scheduled_or_cancelled_events_can_be_deleted:
      "Only scheduled or cancelled events can be deleted.",
    event_has_dependents:
      "This event can't be deleted because tickets or other records still reference it.",
    validation_error:
      "Some event details are invalid. Check the fields below and try again.",
    internal_server_error:
      "Something went wrong on the server while saving the event. Please try again. If the issue continues, contact support with the time you tried.",
  };

  const base = primary[f.error] ?? primary.internal_server_error;

  if (!f.detail?.trim()) return base;

  if (
    f.error === "internal_server_error" &&
    f.detail === "internal_server_error"
  ) {
    return base;
  }

  if (f.error === "validation_error") {
    return f.detail;
  }

  const knownCodes = new Set<string>(Object.keys(primary));
  if (knownCodes.has(f.detail)) {
    return primary[f.detail as EventError] ?? base;
  }

  return `${base} (${f.detail})`;
}

function mapErrorResponse(
  res: Response,
  body: unknown,
  traceId: string,
  route: string,
): MappedEventError {
  const detail = parseBodyDetail(body);
  const validationMsg = parseValidationDetail(body);

  if (res.status === 401) return { error: "unauthorized" };

  if (res.status === 403) return { error: "forbidden" };

  if (res.status === 404 && detail === "event_not_found")
    return { error: "event_not_found" };

  if (res.status === 404 && detail === "venue_not_found")
    return { error: "venue_not_found" };

  if (res.status === 409 && detail === "event_concluded")
    return { error: "event_concluded" };

  if (res.status === 409 && detail === "event_cancelled")
    return { error: "event_cancelled" };

  if (res.status === 409 && detail === "event_has_gate_assignments")
    return { error: "event_has_gate_assignments" };

  if (res.status === 409 && detail === "invalid_status_transition")
    return { error: "invalid_status_transition" };

  if (
    res.status === 409 &&
    detail === "only_scheduled_or_cancelled_events_can_be_deleted"
  ) {
    return { error: "only_scheduled_or_cancelled_events_can_be_deleted" };
  }

  if (res.status === 409 && detail === "event_has_dependents")
    return { error: "event_has_dependents" };

  if (res.status === 422 && detail === "end_time_must_be_after_start_time") {
    return { error: "end_time_must_be_after_start_time" };
  }

  if (res.status === 400 || res.status === 422) {
    return {
      error: "validation_error",
      detail: validationMsg ?? detail,
    };
  }

  console.error(
    "[events] gate->web unexpected_status trace_id=%s response_trace_id=%s route=%s status_code=%s error_hint=%s",
    traceId,
    res.headers.get("X-Trace-Id") ?? "-",
    route,
    res.status,
    formatGateErrorHint(body),
  );

  return { error: "internal_server_error", detail };
}

// ---------------------------------------------------------------------------
// getEvents
// ---------------------------------------------------------------------------

/*
Event List View: all events with admitted_count.
*/
export async function getEvents(
  accessToken: string,
  traceId: string,
): Promise<EventListResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const route = "/dashboard/events";

  console.info(
    "[events] web->gate request trace_id=%s route=GET %s",
    traceId,
    route,
  );

  let res: Response;
  try {
    res = await fetch(`${base}${route}`, {
      method: "GET",
      headers: makeHeaders(accessToken, traceId),
    });
  } catch (e) {
    logTransportError("events", traceId, `GET ${route}`, e);

    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 200) {
    const events = (await res.json()) as EventSummary[];

    return { ok: true, events };
  }

  const body = await parseResponseBody(res);
  const mapped = mapErrorResponse(res, body, traceId, `GET ${route}`);

  return { ok: false, error: mapped.error };
}

// ---------------------------------------------------------------------------
// getEventDetail
// ---------------------------------------------------------------------------

/*
GET /dashboard/events/:id/detail
Event Detail View: identity, schedule, assigned gates, ticket summary.
*/
export async function getEventDetail(
  accessToken: string,
  eventId: string,
  traceId: string,
): Promise<EventDetailResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const route = `/dashboard/events/${eventId}/detail`;

  console.info(
    "[events] web->gate request trace_id=%s route=GET %s",
    traceId,
    route,
  );

  let res: Response;
  try {
    res = await fetch(`${base}${route}`, {
      method: "GET",
      headers: makeHeaders(accessToken, traceId),
    });
  } catch (e) {
    logTransportError("events", traceId, `GET ${route}`, e);

    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 200) {
    const event = (await res.json()) as EventDetail;

    return { ok: true, event };
  }

  const body = await parseResponseBody(res);
  const mapped = mapErrorResponse(res, body, traceId, `GET ${route}`);

  return { ok: false, error: mapped.error };
}

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------

export type CreateEventBody = {
  venue_id: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
};

// POST /dashboard/events
export async function createEvent(
  accessToken: string,
  body: CreateEventBody,
  traceId: string,
): Promise<EventMutationResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
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
      headers: makeHeaders(accessToken, traceId),
      body: JSON.stringify(body),
    });
  } catch (e) {
    logTransportError("events", traceId, `POST ${route}`, e);

    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 201) {
    const event = (await res.json()) as EventSummary;

    return { ok: true, event };
  }

  const resBody = await parseResponseBody(res);
  const mapped = mapErrorResponse(res, resBody, traceId, `POST ${route}`);

  return failure(mapped.error, mapped.detail);
}

// ---------------------------------------------------------------------------
// updateEvent
// ---------------------------------------------------------------------------

export type UpdateEventBody = Partial<{
  name: string;
  venue_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
}>;

// PATCH /dashboard/events/:id

export async function updateEvent(
  accessToken: string,
  eventId: string,
  body: UpdateEventBody,
  traceId: string,
): Promise<EventMutationResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
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
      headers: makeHeaders(accessToken, traceId),
      body: JSON.stringify(body),
    });
  } catch (e) {
    logTransportError("events", traceId, `PATCH ${route}`, e);

    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 200) {
    const event = (await res.json()) as EventSummary;

    return { ok: true, event };
  }

  const resBody = await parseResponseBody(res);
  const mapped = mapErrorResponse(res, resBody, traceId, `PATCH ${route}`);

  return failure(mapped.error, mapped.detail);
}

// ---------------------------------------------------------------------------
// transitionEventStatus
// ---------------------------------------------------------------------------

export type TransitionStatusBody = {
  status: "ACTIVE" | "CONCLUDED" | "CANCELLED";
};

/*
PATCH /dashboard/events/:id/status
The UI surfaces only Cancel but the full set is typed here for completeness.
*/
export async function transitionEventStatus(
  accessToken: string,
  eventId: string,
  body: TransitionStatusBody,
  traceId: string,
): Promise<EventMutationResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const route = `/dashboard/events/${eventId}/status`;

  console.info(
    "[events] web->gate request trace_id=%s route=PATCH %s",
    traceId,
    route,
  );

  let res: Response;
  try {
    res = await fetch(`${base}${route}`, {
      method: "PATCH",
      headers: makeHeaders(accessToken, traceId),
      body: JSON.stringify(body),
    });
  } catch (e) {
    logTransportError("events", traceId, `PATCH ${route}`, e);

    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 200) {
    const event = (await res.json()) as EventSummary;

    return { ok: true, event };
  }

  const resBody = await parseResponseBody(res);
  const mapped = mapErrorResponse(res, resBody, traceId, `PATCH ${route}`);

  return failure(mapped.error, mapped.detail);
}

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------

// DELETE /dashboard/events/:id
export async function deleteEvent(
  accessToken: string,
  eventId: string,
  traceId: string,
): Promise<EventDeleteResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const route = `/dashboard/events/${eventId}`;

  console.info(
    "[events] web->gate request trace_id=%s route=DELETE %s",
    traceId,
    route,
  );

  let res: Response;

  try {
    res = await fetch(`${base}${route}`, {
      method: "DELETE",
      headers: makeHeaders(accessToken, traceId),
    });
  } catch (e) {
    logTransportError("events", traceId, `DELETE ${route}`, e);

    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[events] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 204) return { ok: true };

  const resBody = await parseResponseBody(res);
  const mapped = mapErrorResponse(res, resBody, traceId, `DELETE ${route}`);

  return failure(mapped.error, mapped.detail);
}
