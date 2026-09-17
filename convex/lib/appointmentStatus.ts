import { v } from "convex/values";

/**
 * The canonical appointment status list + validator, shared by the
 * `appointments` table schema, `appointments.ts`, and the denormalized
 * `clients.lastVisit.status` field so a future status addition stays in
 * lockstep across all of them.
 */
export const APPOINTMENT_STATUSES = [
  "pendingApproval",
  "declined",
  "scheduled",
  "checkedIn",
  "inProgress",
  "completed",
  "noShow",
  "cancelled",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const appointmentStatusValidator = v.union(
  ...APPOINTMENT_STATUSES.map((status) => v.literal(status)),
);
