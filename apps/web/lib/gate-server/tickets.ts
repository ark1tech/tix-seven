import type { TicketListResponse, TicketStatus } from "@tix-seven/types";
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

export type TicketError =
    | "unauthorized"
    | "forbidden"
    | "event_not_found"
    | "validation_error"
    | "internal_server_error";

export type TicketListResult =
    | { ok: true; data: TicketListResponse }
    | { ok: false; error: TicketError };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapErrorResponse(
    res: Response,
    body: unknown,
    traceId: string,
    route: string,
): TicketError {
    const detail = parseBodyDetail(body);

    if (res.status === 401) 
        return "unauthorized";

    if (res.status === 403) 
        return "forbidden";

    if (res.status === 404 && detail === "event_not_found")
        return "event_not_found";

    if (res.status === 400 || res.status === 422) 
        return "validation_error";

    console.error(
        "[tickets] gate->web unexpected_status trace_id=%s route=%s status_code=%s",
        traceId,
        route,
        res.status,
    );

    return "internal_server_error";
}

// ---------------------------------------------------------------------------
// getTickets
// ---------------------------------------------------------------------------

export type TicketListParams = {
    status?: TicketStatus;
    sort_by?: "created_at" | "used_at";
    sort_direction?: "asc" | "desc";
};

/*
GET /dashboard/events/:eventId/tickets
Returns summary counts (always unfiltered) + filtered, sorted ticket rows.
*/
export async function getTickets(
    accessToken: string,
    eventId: string,
    params: TicketListParams = {},
    traceId: string,
): Promise<TicketListResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");

    const qs = new URLSearchParams();

    if (params.status) qs.set("status", params.status);
    if (params.sort_by) qs.set("sort_by", params.sort_by);
    if (params.sort_direction) qs.set("sort_direction", params.sort_direction);

    const route = `/dashboard/events/${eventId}/tickets${qs.size ? `?${qs}` : ""}`;

    console.info(
        "[tickets] web->gate request trace_id=%s route=GET %s",
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
        logTransportError("tickets", traceId, `GET ${route}`, e);

        return { ok: false, error: "internal_server_error" };
    }

    console.info(
        "[tickets] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
        traceId,
        res.status,
        res.headers.get("X-Trace-Id") ?? "-",
    );

    if (res.status === 200) {
        const data = (await res.json()) as TicketListResponse;

        return { ok: true, data };
    }

    const body = await parseResponseBody(res);
    
    return {
        ok: false,
        error: mapErrorResponse(res, body, traceId, `GET ${route}`),
    };
}
