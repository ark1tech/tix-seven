import type {
    GateFilterOption,
    LogListResponse,
    LogResult,
} from "@tix-seven/types";
import { makeHeaders, parseBodyDetail, parseResponseBody, requireGateServerUrl } from "../internal";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type LogError =
    | "unauthorized"
    | "forbidden"
    | "event_not_found"
    | "internal_server_error";

export type LogListResult =
    | { ok: true; data: LogListResponse }
    | { ok: false; error: LogError };

export type GateFilterOptionsResult =
    | { ok: true; gates: GateFilterOption[] }
    | { ok: false; error: LogError };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapErrorResponse(
    res: Response,
    body: unknown,
    traceId: string,
    route: string,
): LogError {
    const detail = parseBodyDetail(body);
    if (res.status === 401) 
      return "unauthorized";

    if (res.status === 403) 
      return "forbidden";

    if (res.status === 404 && detail === "event_not_found")
        return "event_not_found";

    console.error(
        "[entry-logs] gate->web unexpected_status trace_id=%s route=%s status_code=%s",
        traceId,
        route,
        res.status,
    );

    return "internal_server_error";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type LogListParams = {
    result?: LogResult;
    gate_id?: string;
    from_time?: string; // ISO 8601
    to_time?: string;   // ISO 8601
};

/*
GET /events/:eventId/logs
Returns the summary bar (unfiltered) + filtered log rows.
*/
export async function getEntryLogs(
    accessToken: string,
    eventId: string,
    params: LogListParams = {},
    traceId: string,
): Promise<LogListResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");

    const qs = new URLSearchParams();

    if (params.result) qs.set("result", params.result);
    if (params.gate_id) qs.set("gate_id", params.gate_id);
    if (params.from_time) qs.set("from_time", params.from_time);
    if (params.to_time) qs.set("to_time", params.to_time);

    const route = `/dashboard/events/${eventId}/logs${qs.size ? `?${qs}` : ""}`;

    console.info(
        "[entry-logs] web->gate request trace_id=%s route=GET %s",
        traceId,
        route,
    );

    let res: Response;

    try {
        res = await fetch(`${base}${route}`, {
            method: "GET",
            headers: makeHeaders(accessToken, traceId),
        });
    } catch {
        console.error(
            "[entry-logs] web->gate transport_error trace_id=%s route=GET %s",
            traceId,
            route,
        );

        return { ok: false, error: "internal_server_error" };
    }

    console.info(
        "[entry-logs] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
        traceId,
        res.status,
        res.headers.get("X-Trace-Id") ?? "-",
    );

    if (res.status === 200) {
        const data = (await res.json()) as LogListResponse;

        return { ok: true, data };
    }

    const body = await parseResponseBody(res);

    return {
        ok: false,
        error: mapErrorResponse(res, body, traceId, `GET ${route}`),
    };
}

/**
GET /events/:eventId/logs/gate-options
Distinct gates that have ever scanned for this event for the filter dropdown.
Only includes gates that are not deleted.
*/
export async function getLogGateFilterOptions(
    accessToken: string,
    eventId: string,
    traceId: string,
): Promise<GateFilterOptionsResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");
    const route = `/dashboard/events/${eventId}/logs/gate-options`;

    console.info(
        "[entry-logs] web->gate request trace_id=%s route=GET %s",
        traceId,
        route,
    );

    let res: Response;

    try {
        res = await fetch(`${base}${route}`, {
            method: "GET",
            headers: makeHeaders(accessToken, traceId),
        });
    } catch {
        console.error(
            "[entry-logs] web->gate transport_error trace_id=%s route=GET %s",
            traceId,
            route,
        );

        return { ok: false, error: "internal_server_error" };
    }

    console.info(
        "[entry-logs] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
        traceId,
        res.status,
        res.headers.get("X-Trace-Id") ?? "-",
    );

    if (res.status === 200) {
        const gates = (await res.json()) as GateFilterOption[];

        return { ok: true, gates };
    }

    const body = await parseResponseBody(res);

    return {
        ok: false,
        error: mapErrorResponse(res, body, traceId, `GET ${route}`),
    };
}
