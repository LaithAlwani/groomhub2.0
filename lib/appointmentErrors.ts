import { ConvexError } from "convex/values";

const ERROR_MESSAGES: Record<string, string> = {
  SLOT_TAKEN: "Another appointment overlaps this slot. Pick a different time.",
  OUTSIDE_AVAILABILITY:
    "The groomer isn't available at this time. Adjust their schedule or pick another slot.",
  FORBIDDEN: "You don't have permission to do that.",
};

/** Human-readable surface for ConvexError codes thrown by appointment mutations. */
export function formatAppointmentError(caught: unknown): string {
  if (caught instanceof ConvexError) {
    const code = (caught.data as { code?: string })?.code;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }
  return caught instanceof Error ? caught.message : "Could not save";
}
