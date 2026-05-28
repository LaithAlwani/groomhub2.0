/**
 * Backend mirror of `lib/phone.ts`'s `normalizePhone` — Convex backend
 * code can't import the browser `lib/` directory, so we duplicate the
 * canonical normalization here. Keep the two in sync if rules change.
 *
 * Rules:
 *   - 7 digits   → prepend "613" (assumed local area code)
 *   - 11 digits starting with "1" → strip the leading "1"
 *   - anything else → digit-stripped pass-through
 *
 * Output is always digits-only and ready to write into `clients.phone`
 * or `clients.altPhones[]`.
 */
export function normalizePhone(phone: string | undefined | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 7) return `613${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}
