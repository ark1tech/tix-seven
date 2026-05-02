import type { IssuedTicket } from "@tix-seven/types";
import { requireGateServerUrl, resolveInternalApiKey, resolveHardwareApiKey } from "./internal";

export type IssueError =
  | "unauthorized"
  | "forbidden"
  | "mosip_unavailable"
  | "identity_not_verified"
  | "event_not_found"
  | "already_issued"
  | "internal_server_error";

export type IssueTicketResult =
  | { ok: true; ticket: IssuedTicket }
  | { ok: false; error: IssueError };

export type MockScanResult =
  | { ok: true; result: "grant" | "deny"; ticket_id?: string; reason?: string }
  | { ok: false; error: string };

function parseBodyDetail(body: unknown): string | undefined {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return undefined;
}

export async function issueTicket(
  accessToken: string,
  eventId: string,
  qrPayload: string,
  traceId: string,
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
      body: JSON.stringify({ qr_payload: qrPayload, event_id: eventId }),
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
    return { ok: false, error: "internal_server_error" };
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
    return { ok: false, error: "unauthorized" };
  }
  if (res.status === 403) {
    return { ok: false, error: "forbidden" };
  }
  if (res.status === 503) {
    return { ok: false, error: "mosip_unavailable" };
  }

  if (res.status === 400 && detail === "identity_not_verified") {
    return { ok: false, error: "identity_not_verified" };
  }
  if (res.status === 404 && detail === "event_not_found") {
    return { ok: false, error: "event_not_found" };
  }
  if (
    res.status === 409 &&
    (detail === "already_issued" || detail === "ticket_already_issued")
  ) {
    return { ok: false, error: "already_issued" };
  }
  if (res.status === 500 && detail === "internal_server_error") {
    return { ok: false, error: "internal_server_error" };
  }
  if (res.status === 500) {
    return { ok: false, error: "internal_server_error" };
  }

  return { ok: false, error: "internal_server_error" };
}

export async function mockScan(
  gateId: string,
  qrPayload: string,
  traceId: string,
): Promise<MockScanResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const hardwareKey = resolveHardwareApiKey();

  console.info(
    "[mock-scan] web->gate request trace_id=%s route=/verify gate_id=%s",
    traceId,
    gateId,
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
      body: JSON.stringify({ qr_payload: qrPayload, gate_id: gateId }),
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
