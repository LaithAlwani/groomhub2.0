import { formatError } from "./formatError";

/**
 * Human-readable surface for errors thrown by appointment mutations. Kept as a
 * thin wrapper over the shared `formatError` so existing call sites keep
 * working while getting the same friendly, non-leaking messages.
 */
export function formatAppointmentError(caught: unknown): string {
  return formatError(caught, "Could not save the appointment. Please try again.");
}
