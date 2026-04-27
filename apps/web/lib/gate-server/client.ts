import type { IssuedTicket } from "@tix-seven/types";

function requireEnv(name: "GATE_SERVER_URL" | "GATE_SERVER_API_KEY"): string {
  const v = process.env[name];
  if (!v?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

type IssueError =
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
  eventId: string,
  qrPayload: string
): Promise<IssueTicketResult> {
  const base = requireEnv("GATE_SERVER_URL").replace(/\/$/, "");
  const key = requireEnv("GATE_SERVER_API_KEY");

  let res: Response;
  try {
    res = await fetch(`${base}/tickets/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gate-Api-Key": key,
      },
      body: JSON.stringify({ qr_payload: qrPayload, event_id: eventId }),
    });
  } catch {
    return { ok: false, error: "internal_server_error" };
  }

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
