import type { Gate } from "@tix-seven/types";
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

export type GateError =
    | "unauthorized"
    | "forbidden"
    | "gate_not_found"
    | "venue_not_found"
    | "event_not_found"
    | "event_not_assignable"
    | "venue_mismatch"
    | "gate_online"
    | "gate_has_active_assignment"
    | "gate_has_dependents"
    | "validation_error"
    | "internal_server_error";

export type CreateGateResult =
    | { ok: true; gate: Gate }
    | { ok: false; error: GateError };

export type UpdateGateResult =
    | { ok: true; gate: Gate }
    | { ok: false; error: GateError };

export type DeleteGateResult = { ok: true } | { ok: false; error: GateError };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapErrorResponse(
    res: Response,
    body: unknown,
    traceId: string,
    route: string,
): GateError {
    const detail = parseBodyDetail(body);

    if (res.status === 401) 
      return "unauthorized";

    if (res.status === 403) 
      return "forbidden";

    if (res.status === 404 && detail === "gate_not_found")
        return "gate_not_found";

    if (res.status === 404 && detail === "venue_not_found")
        return "venue_not_found";

    if (res.status === 404 && detail === "event_not_found")
        return "event_not_found";

    if (res.status === 409 && detail === "event_not_assignable")
        return "event_not_assignable";

    if (res.status === 409 && detail === "venue_mismatch")
        return "venue_mismatch";

    if (res.status === 409 && detail === "gate_online") 
      return "gate_online";

    if (res.status === 409 && detail === "gate_has_active_assignment")
        return "gate_has_active_assignment";

    if (res.status === 409 && detail === "gate_has_dependents")
        return "gate_has_dependents";

    if (res.status === 400 || res.status === 422) 
      return "validation_error";

    console.error(
        "[gates] gate->web unexpected_status trace_id=%s route=%s status_code=%s",
        traceId,
        route,
        res.status,
    );

    return "internal_server_error";
}

// ---------------------------------------------------------------------------
// createGate
// ---------------------------------------------------------------------------

export type CreateGateBody = {
    venue_id: string;
    location: string;
    event_id?: string | null;
};

export async function createGate(
    accessToken: string,
    body: CreateGateBody,
    traceId: string,
): Promise<CreateGateResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");
    const route = "/dashboard/gates";

    console.info(
        "[gates] web->gate request trace_id=%s route=POST %s",
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
        logTransportError("gates", traceId, `POST ${route}`, e);
  
        return { ok: false, error: "internal_server_error" };
    }

    console.info(
        "[gates] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
        traceId,
        res.status,
        res.headers.get("X-Trace-Id") ?? "-",
    );

    if (res.status === 201) {
        const gate = (await res.json()) as Gate;

        return { ok: true, gate };
    }

    const resBody = await parseResponseBody(res);

    return {
        ok: false,
        error: mapErrorResponse(res, resBody, traceId, `POST ${route}`),
    };
}

// ---------------------------------------------------------------------------
// updateGate
// ---------------------------------------------------------------------------

export type UpdateGateBody = Partial<{
    location: string;
    event_id: string | null;
    status: "ONLINE" | "OFFLINE";
}>;

export async function updateGate(
    accessToken: string,
    gateId: string,
    body: UpdateGateBody,
    traceId: string,
): Promise<UpdateGateResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");
    const route = `/dashboard/gates/${gateId}`;

    console.info(
        "[gates] web->gate request trace_id=%s route=PATCH %s",
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
        logTransportError("gates", traceId, `PATCH ${route}`, e);

        return { ok: false, error: "internal_server_error" };
    }

    console.info(
        "[gates] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
        traceId,
        res.status,
        res.headers.get("X-Trace-Id") ?? "-",
    );

    if (res.status === 200) {
        const gate = (await res.json()) as Gate;

        return { ok: true, gate };
    }

    const resBody = await parseResponseBody(res);

    return {
        ok: false,
        error: mapErrorResponse(res, resBody, traceId, `PATCH ${route}`),
    };
}

// ---------------------------------------------------------------------------
// deleteGate
// ---------------------------------------------------------------------------

export async function deleteGate(
    accessToken: string,
    gateId: string,
    traceId: string,
): Promise<DeleteGateResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");
    const route = `/dashboard/gates/${gateId}`;

    console.info(
        "[gates] web->gate request trace_id=%s route=DELETE %s",
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
        logTransportError("gates", traceId, `DELETE ${route}`, e);

        return { ok: false, error: "internal_server_error" };
    }

    console.info(
        "[gates] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
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
