import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SLOT_TAKEN"
  | "OUTSIDE_AVAILABILITY"
  | "SLUG_TAKEN"
  | "SLUG_RESERVED"
  | "SLUG_INVALID"
  | "VALIDATION";

export function appError(code: AppErrorCode, detail?: Record<string, unknown>): never {
  throw new ConvexError({ code, ...(detail ?? {}) });
}
