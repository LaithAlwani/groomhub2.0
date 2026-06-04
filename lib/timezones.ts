/**
 * Timezones we expose in the shop-onboarding picker.
 * Labels are the names people actually say out loud — "Eastern Time",
 * "Pacific Time", not "America/Toronto". One IANA value per common zone is
 * enough because zones that share offsets + DST rules (e.g. Toronto and New
 * York; Vancouver and Los Angeles) produce identical date formatting.
 *
 * North America is listed first (the primary launch market), then a small
 * set of international zones for the shops we're piloting outside it. Convex
 * accepts any IANA string, so adding to this list is purely a UI affordance
 * — `resolveBrowserTimezone()` falls back to the browser's value verbatim
 * when nothing here matches.
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

/**
 * International zones the picker exposes alongside North America. Kept small
 * on purpose — only zones we have a concrete shop or pilot in. Add as the
 * customer base grows.
 */
export const INTERNATIONAL_TIMEZONES: ReadonlyArray<TimezoneOption> = [
  { value: "Europe/London", label: "United Kingdom (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe — Paris (CET)" },
  { value: "Asia/Amman", label: "Jordan — Amman (EET)" },
  { value: "Asia/Dubai", label: "UAE — Dubai (GST)" },
  { value: "Asia/Karachi", label: "Pakistan — Karachi (PKT)" },
  { value: "Asia/Kolkata", label: "India — Kolkata (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Japan — Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia — Sydney (AEST)" },
];

export const ALL_TIMEZONES: ReadonlyArray<TimezoneOption> = [
  ...NORTH_AMERICA_TIMEZONES,
  ...INTERNATIONAL_TIMEZONES,
];

const KNOWN: ReadonlySet<string> = new Set(
  ALL_TIMEZONES.map((zone) => zone.value),
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
