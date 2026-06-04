import type { QueryCtx, MutationCtx } from "../_generated/server";
import { appError } from "./errors";

/**
 * Source of truth for paid-plan tiers and which features each tier unlocks.
 * Adding a new gated feature is one line in `FEATURE_MIN_PLAN`; call sites
 * already use `requirePlanFeature` so nothing else changes.
 */

export type Plan = "essential" | "professional" | "enterprise";

/** Length of the free trial granted at org creation. */
export const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

const PLAN_RANK: Record<Plan, number> = {
  essential: 0,
  professional: 1,
  enterprise: 2,
};

export type PlanFeature =
  | "multipleLocations"
  // Gates the Salon Health + Week Metrics dashboard cards. Professional+.
  | "dashboardSalonHealth"
  // Gates the Top Services + Top Clients dashboard cards. Enterprise+.
  | "dashboardAdvancedAnalytics"
  // Gates the role-based permissions UI in /staff. Professional+.
  | "rolePermissions";
// Reserved for future phases (listed here as comments so the matrix is
// self-documenting): "smsReminders" | "recurringAppointments".

export const FEATURE_MIN_PLAN: Record<PlanFeature, Plan> = {
  multipleLocations: "enterprise",
  dashboardSalonHealth: "professional",
  dashboardAdvancedAnalytics: "enterprise",
  rolePermissions: "professional",
};

export function planAllows(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

/**
 * Max active staff memberships per plan. `null` = unlimited (Enterprise).
 * Enforced in `convex/memberships.ts` before issuing an invite or activating
 * a membership.
 */
const STAFF_CAP: Record<Plan, number | null> = {
  essential: 2,
  professional: 6,
  enterprise: null,
};

export function getStaffCap(plan: Plan): number | null {
  return STAFF_CAP[plan];
}

// Subscription statuses that mean "the org has access to its paid tier".
// `past_due` keeps access during Stripe's dunning grace period; once that
// expires Stripe transitions to `unpaid` or `canceled` and we revoke.
const ACTIVE_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
]);

/**
 * Returns the plan the org should be billed-as for feature-gating purposes:
 *   - If the org's 14-day app-level trial is active → `professional`
 *     (we let trial users evaluate Pro features).
 *   - Else, the plan of the most-recent subscription row whose Stripe status
 *     still confers access (`trialing|active|past_due`).
 *   - Else, `essential` (free tier after trial expires with no subscription).
 *
 * Reads the `organizations` row to find `trialEndsAt` and the `subscriptions`
 * rows by orgId. Org-not-found returns `essential` to fail closed — callers
 * that need to distinguish should query the org directly.
 */
export async function getEffectivePlan(
  ctx: QueryCtx | MutationCtx,
  orgClerkId: string,
): Promise<Plan> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgClerkId))
    .unique();
  if (!org) return "essential";

  if (org.trialEndsAt !== undefined && org.trialEndsAt > Date.now()) {
    return "professional";
  }

  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_org", (index) => index.eq("orgId", orgClerkId))
    .collect();
  const active = subscriptions
    .filter((subscription) => ACTIVE_STATUSES.has(subscription.status))
    .sort((leftSub, rightSub) => rightSub.currentPeriodEnd - leftSub.currentPeriodEnd);
  if (active.length > 0) return active[0].plan;

  return "essential";
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
  const currentPlan = await getEffectivePlan(ctx, orgClerkId);
  if (!planAllows(currentPlan, feature)) {
    appError("PLAN_REQUIRED", {
      feature,
      currentPlan,
      requiredPlan: FEATURE_MIN_PLAN[feature],
    });
  }
}
