/**
 * UUID v4 generator with a fallback chain so it works everywhere the app
 * runs — including non-secure contexts (HTTP dev servers, some embedded
 * WebViews) where `crypto.randomUUID` is unavailable.
 *
 * Order of preference:
 *   1. `crypto.randomUUID()` — native, cryptographically random. Available in
 *      modern browsers under HTTPS / localhost.
 *   2. `crypto.getRandomValues()` + manual layout — same crypto source, just
 *      assembled into the v4 string ourselves. Available in every browser
 *      since ~2014; doesn't require a secure context.
 *   3. `Math.random()` last-resort fallback. Not cryptographic, but the value
 *      here is an idempotency key for the offline-queue, not a secret.
 *
 * Callers should use this instead of `crypto.randomUUID()` directly.
 */

export function generateClientUuid(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch {
        // Fall through — some environments expose the property but throw
        // when called (rare; older Safari quirks).
      }
    }
    if (typeof crypto.getRandomValues === "function") {
      return uuidV4FromRandomValues(crypto.getRandomValues.bind(crypto));
    }
  }
  return uuidV4FromMathRandom();
}

function uuidV4FromRandomValues(
  fill: (buffer: Uint8Array) => Uint8Array,
): string {
  const bytes = new Uint8Array(16);
  fill(bytes);
  // Per RFC 4122 §4.4: set version to 4 and the variant to RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidBytes(bytes);
}

function uuidV4FromMathRandom(): string {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidBytes(bytes);
}

function formatUuidBytes(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    hex.push(bytes[index].toString(16).padStart(2, "0"));
  }
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
