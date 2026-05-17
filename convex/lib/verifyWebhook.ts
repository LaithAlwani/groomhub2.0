// Standard Webhooks signature verification using WebCrypto.
// Implements the same scheme as svix without pulling in the Node-only svix
// package (Convex's default V8 runtime has WebCrypto but not Node's crypto).
// Spec: https://github.com/standard-webhooks/standard-webhooks

const ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type VerifyResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: string };

export async function verifyStandardWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  signingSecret: string,
): Promise<VerifyResult> {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { ok: false, reason: "Missing svix headers" };
  }

  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "Bad timestamp" };
  }
  if (Math.abs(Date.now() - timestampSeconds * 1000) > ALLOWED_CLOCK_SKEW_MS) {
    return { ok: false, reason: "Timestamp outside ±5min window" };
  }

  const rawSecret = signingSecret.startsWith("whsec_")
    ? signingSecret.slice("whsec_".length)
    : signingSecret;
  const secretBytes = base64Decode(rawSecret);

  const signedPayload = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expectedSignature = await hmacSha256Base64(secretBytes, signedPayload);

  // Header format: "v1,<sig> v1,<sig2> ..." (space-separated, possibly multiple)
  const candidates = headers.signature.split(" ");
  for (const candidate of candidates) {
    const [version, providedSignature] = candidate.split(",");
    if (version !== "v1" || !providedSignature) continue;
    if (constantTimeEquals(providedSignature, expectedSignature)) {
      try {
        return { ok: true, payload: JSON.parse(rawBody) };
      } catch {
        return { ok: false, reason: "Body is not valid JSON" };
      }
    }
  }
  return { ok: false, reason: "Signature mismatch" };
}

async function hmacSha256Base64(
  secretBytes: Uint8Array,
  message: string,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message) as BufferSource,
  );
  return base64Encode(new Uint8Array(signature));
}

function base64Decode(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
