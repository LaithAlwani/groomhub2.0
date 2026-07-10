import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/** Fallback country for parsing numbers typed without a leading "+". */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "CA";

export function digitsOnly(phone: string | undefined | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Parse a user-entered number into canonical E.164 (`+16135551000`) for
 * storage. `country` disambiguates numbers typed without a "+". Returns "" for
 * empty input; falls back to a best-effort digit string if the value can't be
 * parsed (so odd entries still round-trip rather than vanishing).
 */
export function toE164(
  input: string | undefined | null,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const parsed = parsePhoneNumberFromString(raw, country);
  if (parsed) return parsed.number;
  const digits = digitsOnly(raw);
  if (!digits) return "";
  return raw.startsWith("+") ? `+${digits}` : digits;
}

/** True when the entry is a valid number for the given country. */
export function isValidPhone(
  input: string | undefined | null,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
  const parsed = parsePhoneNumberFromString((input ?? "").trim(), country);
  return Boolean(parsed && parsed.isValid());
}

/** The country of a stored E.164 number, for repopulating the form picker. */
export function countryOf(
  stored: string | undefined | null,
): CountryCode | undefined {
  return parsePhoneNumberFromString((stored ?? "").trim())?.country;
}

/** Live per-country formatting as the user types (e.g. "(613) 555" for CA). */
export function formatAsYouType(
  input: string | undefined | null,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  return new AsYouType(country).input(input ?? "");
}

/**
 * Display a stored number. North-American numbers keep the familiar
 * xxx-xxx-xxxx dashes; other countries render in international format
 * (e.g. "+44 20 7946 0958"). Accepts E.164 or bare digits.
 */
export function formatPhone(phone: string | undefined | null): string {
  const raw = (phone ?? "").trim();
  const digits = digitsOnly(raw);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  const parsed = parsePhoneNumberFromString(raw);
  if (parsed) return parsed.formatInternational();
  return digits;
}

/**
 * Editable national-format string for a stored number (country code dropped,
 * since the form's country picker owns it). "+16135551000" → "(613) 555-1000".
 */
export function toNationalDisplay(stored: string | undefined | null): string {
  const parsed = parsePhoneNumberFromString((stored ?? "").trim());
  return parsed ? parsed.formatNational() : formatPhone(stored);
}

// ---------------------------------------------------------------------------
// Phone labels (mobile / home / work / other)
// ---------------------------------------------------------------------------
// Backend mirror lives in `convex/lib/phone.ts`; keep the two in sync.

export type PhoneLabel = "mobile" | "home" | "work" | "other";

export const PHONE_LABELS: readonly PhoneLabel[] = [
  "mobile",
  "home",
  "work",
  "other",
];

export const PHONE_LABEL_TEXT: Record<PhoneLabel, string> = {
  mobile: "Mobile",
  home: "Home",
  work: "Work",
  other: "Other",
};

/** An `altPhones[]` entry as stored: a legacy bare string or a labeled object. */
export type StoredPhoneEntry = string | { number: string; label?: PhoneLabel };

export type PhoneEntry = { number: string; label?: PhoneLabel };

/** Coerce either stored shape into a consistent `{ number, label? }`. */
export function normalizePhoneEntry(entry: StoredPhoneEntry): PhoneEntry {
  if (typeof entry === "string") return { number: entry };
  return { number: entry.number, label: entry.label };
}

export function normalizePhoneEntries(
  entries: readonly StoredPhoneEntry[] | undefined,
): PhoneEntry[] {
  return (entries ?? [])
    .map(normalizePhoneEntry)
    .filter((entry) => entry.number.length > 0);
}
