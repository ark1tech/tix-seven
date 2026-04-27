import type { IssuedTicket } from "@tix-seven/types";

function requireGateServerUrl(): string {
  const v = process.env.GATE_SERVER_URL;
  if (!v?.trim()) {
    throw new Error("Missing required environment variable: GATE_SERVER_URL");
  }
  return v;
}

function resolveInternalApiKey(): string {
  const primary = process.env.GATE_SERVER_INTERNAL_API_KEY?.trim();
  if (primary) return primary;
  const fallback = process.env.GATE_SERVER_API_KEY?.trim();
  if (fallback) return fallback;
  throw new Error(
    "Missing required environment variable: GATE_SERVER_INTERNAL_API_KEY (or temporary alias GATE_SERVER_API_KEY)",
  );
}

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
  } catch {
    console.error(
      "[ticket-issue] web->gate transport_error trace_id=%s route=/dashboard/tickets/issue",
      traceId,
    );
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
