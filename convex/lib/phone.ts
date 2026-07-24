import { v } from "convex/values";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/** Fallback country for parsing numbers typed/imported without a "+". */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "CA";

function digits(value: string | undefined | null): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Canonical number normalization for storage — output is E.164
 * (`+16135551000`). `country` disambiguates numbers without a leading "+".
 * Already-E.164 inputs (from the form) round-trip; bare digits (imports/seed)
 * are interpreted in `country`. Falls back to a best-effort digit string when
 * the value can't be parsed so unusual entries still persist.
 *
 * Kept in sync with the frontend mirror in `lib/phone.ts`.
 */
export function toE164(
  input: string | undefined | null,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const parsed = parsePhoneNumberFromString(raw, country);
  if (parsed) return parsed.number;
  const bare = digits(raw);
  if (!bare) return "";
  return raw.startsWith("+") ? `+${bare}` : bare;
}

/**
 * Digit forms a stored number should match against in search: the full E.164
 * digits plus the national significant number (country code stripped). Keeps
 * "613…" prefix search working even though we now store "+1613…".
 */
export function phoneSearchDigits(stored: string | undefined | null): string[] {
  const raw = (stored ?? "").trim();
  const full = digits(raw);
  const parsed = parsePhoneNumberFromString(raw);
  const national = parsed?.nationalNumber ?? full;
  return full === national ? [full] : [full, national];
}

// ---------------------------------------------------------------------------
// Phone labels — a free-text kind for a number (e.g. "Mobile", "Home",
// "Emergency", "Secondary"). Stored as-is; the form offers suggestions but the
// user may type anything.
// ---------------------------------------------------------------------------

export type PhoneLabel = string;

export const phoneLabelValidator = v.string();

/** ISO 3166-1 alpha-2 country code (e.g. "CA", "US", "GB"). */
export const countryCodeValidator = v.string();

/**
 * An `altPhones[]` entry. Legacy rows stored a bare digit string; new rows
 * store `{ number, label? }` (number in E.164). The union keeps old data valid
 * with no migration — read sites normalize via `phoneEntryNumber` /
 * `phoneEntryLabel`.
 */
export const altPhoneEntryValidator = v.union(
  v.string(),
  v.object({ number: v.string(), label: v.optional(phoneLabelValidator) }),
);

export type StoredPhoneEntry =
  | string
  | { number: string; label?: PhoneLabel };

export function phoneEntryNumber(entry: StoredPhoneEntry): string {
  return typeof entry === "string" ? entry : entry.number;
}

export function phoneEntryLabel(entry: StoredPhoneEntry): PhoneLabel | undefined {
  return typeof entry === "string" ? undefined : entry.label;
}
