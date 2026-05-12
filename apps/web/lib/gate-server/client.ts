import type { IssuedTicket } from "@tix-seven/types";
import { requireGateServerUrl, resolveInternalApiKey, resolveHardwareApiKey } from "./internal";

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
  | { ok: true; result: "grant" | "deny"; ticket_id?: string; reason?: string }
  | { ok: false; error: string };

function parseBodyDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("detail" in body)) {
    return undefined;
  }
  const d = (body as { detail: unknown }).detail;
  if (typeof d === "string") {
    return d;
  }
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0];
    if (first && typeof first === "object" && "msg" in first) {
      const msg = (first as { msg: unknown }).msg;
      if (typeof msg === "string") {
        return msg;
      }
    }
  }
  return undefined;
}

function failure(
  error: IssueError,
  detail: string | undefined,
): Extract<IssueTicketResult, { ok: false }> {
  return detail === undefined ? { ok: false, error } : { ok: false, error, detail };
}

/** User-facing explanation for ticket issue failures (code + optional server detail). */
export function formatIssueTicketUserMessage(f: IssueTicketFailure): string {
  const primary: Record<IssueError, string> = {
    unauthorized:
      "You are not signed in, or your session has expired. Sign in again, then retry issuing the ticket.",
    forbidden:
      "Your account is not allowed to issue tickets for this event. Ask an organizer to grant access.",
    mosip_unavailable:
      "The Philsys / MOSIP identity service is temporarily unavailable. Wait a short time and try again.",
    identity_not_verified:
      "This National ID QR was not verified by Philsys. The code may be damaged, a screenshot of a screen, wrong ID type, or not valid for the configured MOSIP environment.",
    event_not_found:
      "No event matches this link. Refresh the page or open the event from your dashboard again.",
    event_not_accepting_tickets:
      "This event is not accepting new tickets right now (for example it is concluded or cancelled).",
    ticket_already_issued:
      "This person already has a ticket for this event. Duplicate issuance is not allowed.",
    network_error:
      "The app could not reach the ticket server. Check your internet connection, VPN, or whether the service is running, then try again.",
    internal_server_error:
      "The ticket server hit an error while saving or processing this request. Try again; if it keeps happening, contact support with the time of the attempt.",
  };

  const base = primary[f.error] ?? primary.internal_server_error;

  if (!f.detail || f.detail.trim() === "") {
    return base;
  }

  if (f.error === "internal_server_error" && f.detail === "internal_server_error") {
    return base;
  }

  return `${base} (${f.detail})`;
}

export async function issueTicket(
  accessToken: string,
  eventId: string,
  qrPayload: string,
  traceId: string,
  stubMosip: boolean = false,
): Promise<IssueTicketResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const internalKey = resolveInternalApiKey();
  const payloadBytes = new TextEncoder().encode(qrPayload).length;

  console.info(
    "[ticket-issue] web->gate request trace_id=%s route=/dashboard/tickets/issue event_id=%s qr_payload_bytes=%s",
    traceId,
    eventId,
    payloadBytes,
  );

  let res: Response;
  try {
    res = await fetch(`${base}/dashboard/tickets/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Internal-Api-Key": internalKey,
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify({ qr_payload: qrPayload, event_id: eventId, stub_mosip: stubMosip }),
    });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const cause = err?.cause ? String(err.cause) : "-";
    console.error(
      "[ticket-issue] web->gate transport_error trace_id=%s route=/dashboard/tickets/issue error=%s cause=%s",
      traceId,
      String(e),
      cause,
    );
    if (err?.stack) {
      console.error("[ticket-issue] web->gate transport_error stack=%s", err.stack);
    }
    if (err?.cause && err.cause instanceof AggregateError) {
      const causes = (err.cause as AggregateError).errors ?? [];
      for (const c of causes) {
        console.error(
          "[ticket-issue] web->gate transport_error cause_detail=%s",
          String(c),
        );
      }
    }
    return failure("network_error", undefined);
  }
  console.info(
    "[ticket-issue] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 201) {
    const data = (await res.json()) as {
      ticket_id: string;
      link_id: string;
      status: "UNUSED";
      created_at: string;
    };
    return {
      ok: true,
      ticket: {
        ticket_id: data.ticket_id,
        link_id: data.link_id,
        status: "UNUSED",
        created_at: data.created_at,
      },
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const detail = parseBodyDetail(body);

  // Auth / gateway (no body detail required; gate-server returns 401 for bad internal key or JWT)
  if (res.status === 401) {
    return failure("unauthorized", undefined);
  }
  if (res.status === 403) {
    return failure("forbidden", undefined);
  }
  if (res.status === 503) {
    return failure("mosip_unavailable", undefined);
  }

  if (res.status === 400 && detail === "identity_not_verified") {
    return failure("identity_not_verified", undefined);
  }
  if (res.status === 404 && detail === "event_not_found") {
    return failure("event_not_found", undefined);
  }
  if (res.status === 409 && detail === "ticket_already_issued") {
    return failure("ticket_already_issued", undefined);
  }
  if (res.status === 409 && detail === "event_not_accepting_tickets") {
    return failure("event_not_accepting_tickets", undefined);
  }
  if (res.status === 500 && detail === "internal_server_error") {
    return failure("internal_server_error", undefined);
  }
  if (res.status === 500) {
    return failure("internal_server_error", detail);
  }

  const extra =
    detail ??
    (res.status >= 400 ? `HTTP ${String(res.status)}` : undefined);
  return failure("internal_server_error", extra);
}

export async function mockScan(
  gateId: string,
  qrPayload: string,
  traceId: string,
  stubMosip: boolean = false,
): Promise<MockScanResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const hardwareKey = resolveHardwareApiKey();

  console.info(
    "[mock-scan] web->gate request trace_id=%s route=/verify gate_id=%s stubbed=%s",
    traceId,
    gateId,
    stubMosip
  );

  let res: Response;
  try {
    res = await fetch(`${base}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gate-Api-Key": hardwareKey,
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify({ qr_payload: qrPayload, gate_id: gateId, stub_mosip: stubMosip }),
    });
  } catch (e) {
    console.error(
      "[mock-scan] web->gate transport_error trace_id=%s route=/verify error=%s",
      traceId,
      String(e),
    );
    return { ok: false, error: "transport_error" };
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = parseBodyDetail(body);
    } catch {
      // ignore
    }
    return { ok: false, error: detail ?? `gate_server_error_${res.status}` };
  }

  const data = await res.json();
  return { ok: true, ...data };
}
