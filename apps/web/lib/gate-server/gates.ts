import type { Gate } from "@tix-seven/types";
import { requireGateServerUrl, resolveInternalApiKey } from "./internal";

export type GateError =
  | "unauthorized"
  | "forbidden"
  | "gate_not_found"
  | "gate_in_use"
  | "validation_error"
  | "internal_server_error";

export type CreateGateResult =
  | { ok: true; gate: Gate }
  | { ok: false; error: GateError };

export type UpdateGateResult =
  | { ok: true; gate: Gate }
  | { ok: false; error: GateError };

export type DeleteGateResult =
  | { ok: true }
  | { ok: false; error: GateError };

function parseBodyDetail(body: unknown): string | undefined {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return undefined;
}

function mapErrorResponse(
  res: Response,
  body: unknown,
  traceId: string,
  route: string,
): GateError {
  const detail = parseBodyDetail(body);
  if (res.status === 401) return "unauthorized";
  if (res.status === 403) return "forbidden";
  if (res.status === 404 && detail === "gate_not_found") return "gate_not_found";
  if (res.status === 409 && detail === "gate_in_use") return "gate_in_use";
  if (res.status === 400) return "validation_error";
  console.error(
    "[gates] gate->web unexpected_status trace_id=%s route=%s status_code=%s",
    traceId,
    route,
    res.status,
  );
  return "internal_server_error";
}

export async function createGate(
  accessToken: string,
  body: { location: string; event_id?: string | null },
  traceId: string,
): Promise<CreateGateResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const internalKey = resolveInternalApiKey();
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Internal-Api-Key": internalKey,
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify(body),
    });
  } catch {
    console.error(
      "[gates] web->gate transport_error trace_id=%s route=POST %s",
      traceId,
      route,
    );
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

  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { ok: false, error: mapErrorResponse(res, resBody, traceId, `POST ${route}`) };
}

export async function updateGate(
  accessToken: string,
  gateId: string,
  body: Partial<{ location: string; event_id: string | null }>,
  traceId: string,
): Promise<UpdateGateResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const internalKey = resolveInternalApiKey();
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Internal-Api-Key": internalKey,
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify(body),
    });
  } catch {
    console.error(
      "[gates] web->gate transport_error trace_id=%s route=PATCH %s",
      traceId,
      route,
    );
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

  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { ok: false, error: mapErrorResponse(res, resBody, traceId, `PATCH ${route}`) };
}

export async function deleteGate(
  accessToken: string,
  gateId: string,
  traceId: string,
): Promise<DeleteGateResult> {
  const base = requireGateServerUrl().replace(/\/$/, "");
  const internalKey = resolveInternalApiKey();
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Internal-Api-Key": internalKey,
        "X-Trace-Id": traceId,
      },
    });
  } catch {
    console.error(
      "[gates] web->gate transport_error trace_id=%s route=DELETE %s",
      traceId,
      route,
    );
    return { ok: false, error: "internal_server_error" };
  }

  console.info(
    "[gates] gate->web response trace_id=%s status_code=%s response_trace_id=%s",
    traceId,
    res.status,
    res.headers.get("X-Trace-Id") ?? "-",
  );

  if (res.status === 204) {
    return { ok: true };
  }

  let resBody: unknown;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }
  return { ok: false, error: mapErrorResponse(res, resBody, traceId, `DELETE ${route}`) };
}
