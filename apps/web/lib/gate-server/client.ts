import type { IssuedTicket } from "@tix-seven/types";
import {
    logTransportError,
    makeHardwareHeaders,
    makeHeaders,
    parseBodyDetail,
    parseResponseBody,
    requireGateServerUrl,
} from "../internal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueError =
    | "unauthorized"
    | "forbidden"
    | "mosip_unavailable"
    | "identity_not_verified"
    | "event_not_found"
    | "event_not_accepting_tickets"
    | "ticket_already_issued"
    | "network_error"
    | "internal_server_error";

export type IssueTicketResult =
    | { ok: true; ticket: IssuedTicket }
    | { ok: false; error: IssueError; detail?: string };

export type IssueTicketFailure = Extract<IssueTicketResult, { ok: false }>;

export type MockScanResult =
    | {
          ok: true;
          result: "grant" | "deny";
          ticket_id?: string;
          reason?: string;
      }
    | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failure(error: IssueError, detail?: string): IssueTicketFailure {
    return detail === undefined
        ? { ok: false, error }
        : { ok: false, error, detail };
}

// ---------------------------------------------------------------------------
// User-facing error messages
// ---------------------------------------------------------------------------

export function formatIssueTicketUserMessage(f: IssueTicketFailure): string {
    const primary: Record<IssueError, string> = {
        unauthorized:
            "You're not signed in or your session has expired. Please sign in again and try issuing the ticket.",
        forbidden:
            "Your account doesn't have permission to issue tickets for this event. If you think this is a mistake, contact an admin to review your access.",
        mosip_unavailable:
            "The national ID PhilSys/MOSIP verification service is temporarily unavailable. Please try again in a few moments.",
        identity_not_verified:
            "We couldn't verify this National ID QR code with PhilSys. It may be damaged, a screenshot, the wrong ID type, or not valid in this system.",
        event_not_found:
            "We couldn't find this event. Try refreshing the page or reopening it from your dashboard.",
        event_not_accepting_tickets:
            "This event isn't accepting tickets right now. It may have already ended or been cancelled.",
        ticket_already_issued:
            "This person already has a ticket for this event. Duplicate ticket issuance isn't allowed.",
        network_error:
            "We couldn't reach the ticket server. Check your internet connection and try again.",
        internal_server_error:
            "Something went wrong on the server while processing your request. Please try again. If the issue continues, contact support with the time you tried.",
    };

    const base = primary[f.error] ?? primary.internal_server_error;

    if (!f.detail?.trim()) return base;

    if (
        f.error === "internal_server_error" &&
        f.detail === "internal_server_error"
    )
        return base;

    return `${base} (${f.detail})`;
}

// ---------------------------------------------------------------------------
// issueTicket
// ---------------------------------------------------------------------------

export async function issueTicket(
    accessToken: string,
    eventId: string,
    qrPayload: string,
    traceId: string,
    stubMosip = false,
): Promise<IssueTicketResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");
    const route = "/dashboard/tickets/issue";

    console.info(
        "[ticket-issue] web->gate request trace_id=%s route=POST %s event_id=%s qr_payload_bytes=%s",
        traceId,
        route,
        eventId,
        new TextEncoder().encode(qrPayload).length,
    );

    let res: Response;

    try {
        res = await fetch(`${base}${route}`, {
            method: "POST",
            headers: makeHeaders(accessToken, traceId),
            body: JSON.stringify({
                qr_payload: qrPayload,
                event_id: eventId,
                stub_mosip: stubMosip,
            }),
        });
    } catch (e) {
        logTransportError("ticket-issue", traceId, `POST ${route}`, e);

        return failure("network_error");
    }

    console.info(
        "[ticket-issue] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
        traceId,
        res.status,
        res.headers.get("X-Trace-Id") ?? "-",
    );

    if (res.status === 201) {
        const data = (await res.json()) as IssuedTicket;

        return { ok: true, ticket: data };
    }

    const body = await parseResponseBody(res);
    const detail = parseBodyDetail(body);

    if (res.status === 401) 
        return failure("unauthorized");

    if (res.status === 403) 
        return failure("forbidden");

    if (res.status === 503) 
        return failure("mosip_unavailable");

    if (res.status === 400 && detail === "identity_not_verified")
        return failure("identity_not_verified");

    if (res.status === 404 && detail === "event_not_found")
        return failure("event_not_found");

    if (res.status === 409 && detail === "ticket_already_issued")
        return failure("ticket_already_issued");

    if (res.status === 409 && detail === "event_not_accepting_tickets")
        return failure("event_not_accepting_tickets");

    if (res.status === 500 && detail === "internal_server_error")
        return failure("internal_server_error");

    if (res.status === 500) 
        return failure("internal_server_error", detail);

    const extra =
        detail ?? (res.status >= 400 ? `HTTP ${res.status}` : undefined);

    return failure("internal_server_error", extra);
}

// ---------------------------------------------------------------------------
// mockScan
// ---------------------------------------------------------------------------

export async function mockScan(
    gateId: string,
    qrPayload: string,
    traceId: string,
    stubMosip = false,
): Promise<MockScanResult> {
    const base = requireGateServerUrl().replace(/\/$/, "");
    const route = "/verify";

    console.info(
        "[mock-scan] web->gate request trace_id=%s route=POST %s gate_id=%s stubbed=%s",
        traceId,
        route,
        gateId,
        stubMosip,
    );

    let res: Response;

    try {
        res = await fetch(`${base}${route}`, {
            method: "POST",
            headers: makeHardwareHeaders(traceId),
            body: JSON.stringify({
                qr_payload: qrPayload,
                gate_id: gateId,
                stub_mosip: stubMosip,
            }),
        });
    } catch (e) {
        logTransportError("mock-scan", traceId, `POST ${route}`, e);

        return { ok: false, error: "transport_error" };
    }

    console.info(
        "[mock-scan] gate->web response trace_id=%s status_code=%s",
        traceId,
        res.status,
    );

    if (!res.ok) {
        const body = await parseResponseBody(res);
        const detail = parseBodyDetail(body);

        return {
            ok: false,
            error: detail ?? `gate_server_error_${res.status}`,
        };
    }

    const data = await res.json();

    return { ok: true, ...data };
}
