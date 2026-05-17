export function requireGateServerUrl(): string {
  const v = process.env.GATE_SERVER_URL;

  if (!v?.trim()) {
    throw new Error("Missing required environment variable: GATE_SERVER_URL");
  }

  return v;
}

export function resolveInternalApiKey(): string {
  const key = process.env.GATE_SERVER_INTERNAL_API_KEY?.trim();

  if (key) return key;

  throw new Error(
    "Missing required environment variable: GATE_SERVER_INTERNAL_API_KEY",
  );
}

export function resolveHardwareApiKey(): string {
  const key = process.env.GATE_HARDWARE_API_KEY?.trim();

  if (key) return key;

  throw new Error(
    "Missing required environment variable: GATE_HARDWARE_API_KEY",
  );
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function makeHeaders(accessToken: string, traceId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-Internal-Api-Key": resolveInternalApiKey(),
    "X-Trace-Id": traceId,
  };
}

export function makeHardwareHeaders(traceId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Gate-Api-Key": resolveHardwareApiKey(),
    "X-Trace-Id": traceId,
  };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export async function parseResponseBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function parseBodyDetail(body: unknown): string | undefined {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;

    if (typeof d === "string") {
      return d;
    }
  }

  return undefined;
}

/**
 * First human-readable message from FastAPI `RequestValidationError` (`detail` array).
 */
export function parseValidationDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("detail" in body)) {
    return undefined;
  }

  const d = (body as { detail: unknown }).detail;

  if (!Array.isArray(d) || d.length === 0) {
    return undefined;
  }

  const first = d[0];

  if (first && typeof first === "object" && "msg" in first) {
    const msg = (first as { msg: unknown }).msg;

    if (typeof msg === "string" && msg.trim()) {
      return msg.trim();
    }
  }

  return undefined;
}

const GATE_ERROR_BODY_HINT_MAX_CHARS = 500;

/**
 * Prefer API `detail` when present; otherwise a capped JSON/text hint for logs.
 */
export function formatGateErrorHint(body: unknown): string {
  const detail = parseBodyDetail(body);
  if (detail !== undefined) {
    return detail;
  }
  if (body === null) {
    return "-";
  }
  try {
    const s = JSON.stringify(body);
    if (s.length <= GATE_ERROR_BODY_HINT_MAX_CHARS) {
      return s;
    }
    return `${s.slice(0, GATE_ERROR_BODY_HINT_MAX_CHARS)}…`;
  } catch {
    const s = String(body);
    if (s.length <= GATE_ERROR_BODY_HINT_MAX_CHARS) {
      return s;
    }
    return `${s.slice(0, GATE_ERROR_BODY_HINT_MAX_CHARS)}…`;
  }
}

export function logTransportError(
  module: string,
  traceId: string,
  route: string,
  e: unknown,
): void {
  const err = e as Error & { cause?: unknown };
  const cause = err?.cause ? String(err.cause) : "-";

  console.error(
    "[%s] web->gate transport_error trace_id=%s route=%s error=%s cause=%s",
    module,
    traceId,
    route,
    String(e),
    cause,
  );

  if (err?.stack) {
    console.error("[%s] web->gate transport_error stack=%s", module, err.stack);
  }

  if (err?.cause instanceof AggregateError) {
    for (const c of (err.cause as AggregateError).errors ?? []) {
      console.error(
        "[%s] web->gate transport_error cause_detail=%s",
        module,
        String(c),
      );
    }
  }
}
