/**
 * North American timezones we expose in the shop-onboarding picker.
 * Labels are the names people actually say out loud — "Eastern Time",
 * "Pacific Time", not "America/Toronto". One IANA value per common zone is
 * enough because zones that share offsets + DST rules (e.g. Toronto and New
 * York; Vancouver and Los Angeles) produce identical date formatting.
 *
 * Ordered roughly west → east so the list scans like a map. Special-case
 * no-DST zones (Arizona, Saskatchewan, Yukon) are listed inline next to
 * their DST-observing siblings.
 *
 * Shops outside this list (Europe / Asia / etc.) still work — Convex accepts
 * any IANA string. `resolveBrowserTimezone()` returns the browser's value
 * verbatim when nothing here matches.
 */

export type TimezoneOption = {
  value: string; // IANA name, e.g. "America/Toronto"
  label: string; // Friendly name shown in the dropdown
};

export const NORTH_AMERICA_TIMEZONES: ReadonlyArray<TimezoneOption> = [
  { value: "America/St_Johns", label: "Newfoundland Standard Time (NST)" },
  { value: "America/Halifax", label: "Atlantic Standard Time (AST)" },
  { value: "America/Toronto", label: "Eastern Standard Time (EST)" },
  { value: "America/Chicago", label: "Central Standard Time (CST)" },
  { value: "America/Denver", label: "Mountain Standard Time (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Standard Time (PST)" },
];

const KNOWN: ReadonlySet<string> = new Set(
  NORTH_AMERICA_TIMEZONES.map((zone) => zone.value),
);

// Map browser IANA → our canonical IANA. Lets a Vancouver browser still pick
// PST automatically even though we list America/Los_Angeles as the
// representative for that zone.
const ALIASES: Record<string, string> = {
  // Pacific
  "America/Vancouver": "America/Los_Angeles",
  "America/Tijuana": "America/Los_Angeles",
  // Mountain
  "America/Edmonton": "America/Denver",
  "America/Yellowknife": "America/Denver",
  "America/Phoenix": "America/Denver",
  "America/Whitehorse": "America/Denver",
  // Central
  "America/Winnipeg": "America/Chicago",
  "America/Regina": "America/Chicago",
  "America/Mexico_City": "America/Chicago",
  // Eastern
  "America/New_York": "America/Toronto",
  "America/Detroit": "America/Toronto",
  "America/Montreal": "America/Toronto",
  "America/Cancun": "America/Toronto",
};

export function isKnownTimezone(value: string): boolean {
  return KNOWN.has(value);
}

/**
 * Returns the browser's IANA timezone, mapped to the closest one we list, or
 * the supplied fallback if there's no good match.
 */
export function resolveBrowserTimezone(fallback: string): string {
  if (typeof Intl === "undefined") return fallback;
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!browserTz) return fallback;
  if (KNOWN.has(browserTz)) return browserTz;
  const aliased = ALIASES[browserTz];
  if (aliased && KNOWN.has(aliased)) return aliased;
  return fallback;
}
