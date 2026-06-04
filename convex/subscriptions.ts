/**
 * Read-side queries for the billing UI. The page composes this with
 * `organizations.getCurrent` (effectivePlan + trial info) and the Stripe
 * actions in `convex/stripe.ts` (payment method + invoice list) to render
 * everything in `/settings/billing`.
 */

import { query } from "./_generated/server";
import { softAuth } from "./lib/tenant";
import type { Doc } from "./_generated/dataModel";

const ACTIVE_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "incomplete",
]);

/**
 * Returns the org's most-recent subscription row whose status still means
 * "currently billed" (or just `incomplete` for a freshly-created one
 * mid-checkout). Returns null when the org is purely on the free trial or has
 * never subscribed.
 *
 * Picks the highest `currentPeriodEnd` so a refresh / upgrade that creates a
 * new subscription supersedes the old row in the UI immediately.
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx): Promise<Doc<"subscriptions"> | null> => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .collect();
    const active = rows
      .filter((subscription) => ACTIVE_STATUSES.has(subscription.status))
      .sort(
        (leftSub, rightSub) =>
          rightSub.currentPeriodEnd - leftSub.currentPeriodEnd,
      );
    return active[0] ?? null;
  },
});
