/**
 * Toggle "reserved for second factor" on a Clerk user's email address.
 *
 *   ON  → that account will require an email code as a second factor at
 *         sign-in (use this to TEST the MFA flow).
 *   OFF → removes the requirement (use this to FIX an account like the one
 *         that got stuck, e.g. ottawapamperedpet@gmail.com).
 *
 * Usage (loads CLERK_SECRET_KEY from .env.local — your DEV instance):
 *   node --env-file=.env.local scripts/clerk-second-factor.mjs <email> on
 *   node --env-file=.env.local scripts/clerk-second-factor.mjs <email> off
 *
 * To act on PRODUCTION instead, run with the production secret key:
 *   CLERK_SECRET_KEY=sk_live_xxx node scripts/clerk-second-factor.mjs <email> off
 */

const API = "https://api.clerk.com/v1";
const [, , emailArg, modeArg] = process.argv;
const secret = process.env.CLERK_SECRET_KEY;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!secret) fail("CLERK_SECRET_KEY is not set (pass --env-file=.env.local).");
if (!emailArg) fail("Provide an email: … clerk-second-factor.mjs <email> on|off");
if (modeArg !== "on" && modeArg !== "off") {
  fail("Second arg must be 'on' or 'off'.");
}
const reserved = modeArg === "on";
const email = emailArg.trim().toLowerCase();

const headers = {
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

async function api(path, init) {
  const response = await fetch(`${API}${path}`, { headers, ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(
      `${init?.method ?? "GET"} ${path} → ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

const instance = secret.startsWith("sk_live") ? "PRODUCTION" : "development";
console.log(`Instance: ${instance}`);

// 1. Find the user by email.
const users = await api(`/users?email_address=${encodeURIComponent(email)}`);
if (!Array.isArray(users) || users.length === 0) {
  fail(`No user found with email ${email} on this instance.`);
}
if (users.length > 1) {
  console.log(`⚠ ${users.length} users match; using the first.`);
}
const user = users[0];

// 2. Find the matching email-address record on that user.
const emailRecord = (user.email_addresses ?? []).find(
  (row) => row.email_address?.toLowerCase() === email,
);
if (!emailRecord) fail(`User ${user.id} has no email address ${email}.`);

console.log(
  `User ${user.id} · email ${emailRecord.id} · reserved_for_second_factor: ${emailRecord.reserved_for_second_factor} → ${reserved}`,
);

// 3. Patch the flag.
const updated = await api(
  `/users/${user.id}/email_addresses/${emailRecord.id}`,
  { method: "PATCH", body: JSON.stringify({ reserved_for_second_factor: reserved }) },
);

console.log(
  `✓ Done. reserved_for_second_factor is now: ${updated.reserved_for_second_factor}`,
);
