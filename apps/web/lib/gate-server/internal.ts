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
