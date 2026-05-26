import type { QueryCtx, MutationCtx } from "../_generated/server";
import { appError } from "./errors";

/**
 * Source of truth for paid-plan tiers and which features each tier unlocks.
 * Adding a new gated feature is one line in `FEATURE_MIN_PLAN`; call sites
 * already use `requirePlanFeature` so nothing else changes.
 */

export type Plan = "essential" | "professional" | "enterprise";

const PLAN_RANK: Record<Plan, number> = {
  essential: 0,
  professional: 1,
  enterprise: 2,
};

export type PlanFeature =
  | "multipleLocations";
// Reserved for future phases (listed here as comments so the matrix is
// self-documenting): "smsReminders" | "recurringAppointments" | "analytics".

export const FEATURE_MIN_PLAN: Record<PlanFeature, Plan> = {
  multipleLocations: "enterprise",
};

export function planAllows(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

/**
 * Asserts the org's current plan tier includes the named feature. Throws
 * `PLAN_REQUIRED` (with the current + required tiers attached) so callers
 * can render a precise upgrade nudge.
 */
export async function requirePlanFeature(
  ctx: QueryCtx | MutationCtx,
  orgClerkId: string,
  feature: PlanFeature,
): Promise<void> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgClerkId))
    .unique();
  if (!org) appError("NOT_FOUND", { reason: "ORG_NOT_FOUND" });
  const currentPlan = org.plan as Plan;
  if (!planAllows(currentPlan, feature)) {
    appError("PLAN_REQUIRED", {
      feature,
      currentPlan,
      requiredPlan: FEATURE_MIN_PLAN[feature],
    });
  }
}
