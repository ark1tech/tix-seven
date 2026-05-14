import type { EventDetail, EventSummary } from "@tix-seven/types";
import {
    logTransportError,
    makeHeaders,
    parseBodyDetail,
    parseResponseBody,
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

export type EventMutationResult =
    | { ok: true; event: EventSummary }
    | { ok: false; error: EventError };

export type EventDeleteResult = { ok: true } | { ok: false; error: EventError };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapErrorResponse(
    res: Response,
    body: unknown,
    traceId: string,
    route: string,
): EventError {
    const detail = parseBodyDetail(body);

    if (res.status === 401) 
        return "unauthorized";

    if (res.status === 403) 
        return "forbidden";

    if (res.status === 404 && detail === "event_not_found")
        return "event_not_found";

    if (res.status === 404 && detail === "venue_not_found")
        return "venue_not_found";

    if (res.status === 409 && detail === "event_concluded")
        return "event_concluded";

    if (res.status === 409 && detail === "event_cancelled")
        return "event_cancelled";

    if (res.status === 409 && detail === "event_has_gate_assignments")
        return "event_has_gate_assignments";

    if (res.status === 409 && detail === "invalid_status_transition")
        return "invalid_status_transition";

    if (
        res.status === 409 &&
        detail === "only_scheduled_or_cancelled_events_can_be_deleted"
    )
        return "only_scheduled_or_cancelled_events_can_be_deleted";

    if (res.status === 409 && detail === "event_has_dependents")
        return "event_has_dependents";

    if (res.status === 422 && detail === "end_time_must_be_after_start_time")
        return "end_time_must_be_after_start_time";

    if (res.status === 400 || res.status === 422) 
        return "validation_error";

    console.error(
        "[events] gate->web unexpected_status trace_id=%s route=%s status_code=%s",
        traceId,
        route,
        res.status,
    );

    return "internal_server_error";
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

    return {
        ok: false,
        error: mapErrorResponse(res, body, traceId, `GET ${route}`),
    };
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

    return {
        ok: false,
        error: mapErrorResponse(res, body, traceId, `GET ${route}`),
    };
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

    return {
        ok: false,
        error: mapErrorResponse(res, resBody, traceId, `POST ${route}`),
    };
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

    return {
        ok: false,
        error: mapErrorResponse(res, resBody, traceId, `PATCH ${route}`),
    };
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

    return {
        ok: false,
        error: mapErrorResponse(res, resBody, traceId, `PATCH ${route}`),
    };
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
    
    return {
        ok: false,
        error: mapErrorResponse(res, resBody, traceId, `DELETE ${route}`),
    };
}
