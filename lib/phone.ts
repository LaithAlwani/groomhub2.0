export function digitsOnly(phone: string | undefined | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Canonical phone normalization for storage. Output is always digits-only,
 * pre-shaped so `formatPhone` can render it as xxx-xxx-xxxx without
 * surprises.
 *
 * Rules:
 *   - 7 digits      → prepend "613" (assumed local area code — Ottawa /
 *                     Eastern Ontario region; many older CRM exports drop
 *                     the area code on local numbers)
 *   - 11 digits starting with "1" (US/CA country code) → strip the "1"
 *                     so storage is the canonical 10-digit form
 *   - everything else → returned as digit-stripped, even if unusual length
 *                     (data round-trips; display just won't pretty-format)
 */
export function normalizePhone(phone: string | undefined | null): string {
  const digits = digitsOnly(phone);
  if (digits.length === 7) return `613${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/**
 * Formats a US-style phone number as xxx-xxx-xxxx. 11-digit numbers that
 * start with "1" are formatted the same way, dropping the country code.
 * Anything else is returned as-is (digits only) so unusual lengths still
 * render legibly.
 */
export function formatPhone(phone: string | undefined | null): string {
  const digits = digitsOnly(phone);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}
