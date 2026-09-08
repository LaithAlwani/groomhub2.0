/**
 * Gates the clients board search so cheap partial queries never reach the
 * (expensive, whole-table) `clients.listWithPets` scan.
 *
 * A trailing debounce alone can't stop this: it only collapses keystrokes typed
 * faster than the delay. A slow typist who pauses longer than the debounce
 * between keystrokes settles — and fires a full-table scan — on EVERY
 * intermediate value ("6", "61", "613", …). Requiring a minimum length keeps
 * those partial values in "browse" mode so only a meaningful query runs a scan.
 */

// Digit-only queries take `scanPhoneMatches`, which streams the whole org's
// clients. Require enough digits that a bare area-code prefix can't trigger it.
export const MIN_PHONE_DIGITS = 4;
// Text queries are index-backed (cheap) but still fire per settled value;
// three characters keeps short-prefix noise out without hurting real lookups.
export const MIN_TEXT_CHARS = 3;

/**
 * True when `raw` is worth sending to the server search. Mirrors the server's
 * digit-query detection in `convex/clients.ts` so the gate matches the path the
 * query would actually take.
 */
export function shouldRunClientSearch(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  const digitsOnly = trimmed.replace(/\D/g, "");
  const isDigitQuery = digitsOnly.length > 0 && digitsOnly === trimmed;
  if (isDigitQuery) return digitsOnly.length >= MIN_PHONE_DIGITS;
  return trimmed.length >= MIN_TEXT_CHARS;
}
