import type { Doc } from "@/convex/_generated/dataModel";
import type { CountryCode } from "libphonenumber-js";
import {
  countryOf,
  DEFAULT_PHONE_COUNTRY,
  normalizePhoneEntries,
  toE164,
  toNationalDisplay,
  type PhoneLabel,
} from "@/lib/phone";

/**
 * One phone row in the client form. `number` holds the national-format display
 * string (formatted as-you-type); `country` picks how it's parsed to E.164;
 * `label` is "" when the number's kind is unset. The first row is primary.
 */
export type PhoneFormEntry = {
  number: string;
  label: PhoneLabel | "";
  country: CountryCode;
};

export const EMPTY_PHONE: PhoneFormEntry = {
  number: "",
  label: "",
  country: DEFAULT_PHONE_COUNTRY,
};

/** Seed the form's phone rows from a saved client (primary first, then alts). */
export function phonesFromClient(
  client: Doc<"clients">,
  fallbackCountry: CountryCode,
): PhoneFormEntry[] {
  const entries: PhoneFormEntry[] = [];
  if (client.phone) {
    entries.push({
      number: toNationalDisplay(client.phone),
      label: client.phoneLabel ?? "",
      country: countryOf(client.phone) ?? fallbackCountry,
    });
  }
  for (const entry of normalizePhoneEntries(client.altPhones)) {
    entries.push({
      number: toNationalDisplay(entry.number),
      label: entry.label ?? "",
      country: countryOf(entry.number) ?? fallbackCountry,
    });
  }
  return entries.length > 0 ? entries : [{ ...EMPTY_PHONE, country: fallbackCountry }];
}

type PhonePayload = {
  phone?: string;
  phoneLabel?: PhoneLabel;
  altPhones?: Array<{ number: string; label?: PhoneLabel }>;
};

/**
 * Split the form rows into the mutation payload. Each number is parsed to
 * E.164 using its row's country; the first becomes the primary (with label),
 * the rest labeled `altPhones`. De-duped by E.164.
 */
export function phonesToPayload(rows: PhoneFormEntry[]): PhonePayload {
  const seen = new Set<string>();
  const cleaned: Array<{ number: string; label: PhoneLabel | "" }> = [];
  for (const row of rows) {
    const number = toE164(row.number, row.country);
    if (number.length === 0 || seen.has(number)) continue;
    seen.add(number);
    cleaned.push({ number, label: row.label });
  }
  const [primary, ...alts] = cleaned;
  return {
    phone: primary?.number || undefined,
    phoneLabel: primary?.label || undefined,
    altPhones:
      alts.length > 0
        ? alts.map((entry) =>
            entry.label
              ? { number: entry.number, label: entry.label }
              : { number: entry.number },
          )
        : undefined,
  };
}
