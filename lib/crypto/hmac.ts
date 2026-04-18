const encoder = new TextEncoder();

export async function hashUIN(uin: string): Promise<string> {
  const pepper = process.env.HMAC_PEPPER;
  if (!pepper) throw new Error("HMAC_PEPPER is not set");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(uin)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
