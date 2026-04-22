const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPSUT(psut: string, eventID: string): Promise<string> {
  const pepper = process.env.HMAC_PEPPER;
  if (!pepper) throw new Error("HMAC_PEPPER is not set");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const message = `${psut}:${eventID}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return toHex(signature);
}