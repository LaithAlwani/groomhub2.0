import { ConvexError } from "convex/values";

/**
 * Turns any thrown value into a message that's safe + sensible to show a user.
 *
 * The important job: a `ConvexError` thrown by our backend (via `appError`)
 * carries a `{ code, reason, … }` payload, and its `.message` is the raw
 * JSON of that payload — which must NEVER be shown to a user. We map known
 * codes/reasons to friendly copy and fall back to the caller's message
 * otherwise, so no internal diagnostics leak into the UI.
 */

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in again and retry.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find that — it may have been removed.",
  SLOT_TAKEN: "Another appointment overlaps this slot. Pick a different time.",
  OUTSIDE_AVAILABILITY:
    "The groomer isn't available at that time. Adjust their schedule or pick another slot.",
  SLUG_TAKEN: "That web address is already taken. Try another.",
  SLUG_RESERVED: "That web address is reserved. Try another.",
  SLUG_INVALID: "That web address isn't valid.",
  PLAN_REQUIRED: "Your current plan doesn't include this feature.",
  VALIDATION: "Some details need fixing — please check the form and try again.",
};

// More specific than the code where it helps. Keyed by the `reason` we attach.
const REASON_MESSAGES: Record<string, string> = {
  NOT_OWN_APPOINTMENT: "You can only change appointments assigned to you.",
  WRONG_ORG: "That item belongs to another shop.",
  ARCHIVED: "That item has been archived and can't be used.",
  PET_DECEASED: "This pet is marked deceased and can't be booked.",
  PET_BANNED: "This pet is banned and can't be booked.",
  INACTIVE_STAFF: "That staff member is inactive.",
  CAN_ONLY_DECLINE_PENDING: "Only bookings awaiting approval can be declined.",
  ONLY_ASSIGNED_GROOMER_CAN_DECLINE:
    "Only the assigned groomer can decline this booking.",
  LOCATION_INACTIVE: "That location is no longer active.",
  WRONG_LOCATION: "That service isn't offered at this location.",
};

export function formatError(
  caught: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (caught instanceof ConvexError) {
    const data = caught.data as
      | { code?: string; reason?: string }
      | undefined;
    if (data?.reason && REASON_MESSAGES[data.reason]) {
      return REASON_MESSAGES[data.reason];
    }
    if (data?.code && CODE_MESSAGES[data.code]) {
      return CODE_MESSAGES[data.code];
    }
    // Known-shape backend error but no friendly mapping — use the caller's
    // fallback rather than leaking the raw payload.
    return fallback;
  }
  // Plain JS/network errors carry human-readable messages already.
  if (caught instanceof Error && caught.message) return caught.message;
  return fallback;
}
