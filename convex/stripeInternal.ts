/**
 * V8-runtime helpers for the Stripe billing flow. `convex/stripe.ts` runs on
 * Node (so it can import the `stripe` SDK) and calls into these via
 * `ctx.runQuery` / `ctx.runMutation`. The webhook bridge in
 * `convex/stripeWebhook.ts` reuses the upsert/cancel mutations defined here.
 *
 * Nothing in this file talks to Stripe directly — it's all Convex db.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const PLAN_VALIDATOR = v.union(
  v.literal("essential"),
  v.literal("professional"),
  v.literal("enterprise"),
);

const STATUS_VALIDATOR = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("incomplete"),
  v.literal("incomplete_expired"),
  v.literal("unpaid"),
  v.literal("paused"),
);

/**
 * Looks up the org row and every subscription row for it. Used by the Stripe
 * actions to decide whether to create a brand-new customer/subscription or
 * mutate an existing one.
 */
export const getOrgForBilling = internalQuery({
  args: { clerkOrgId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    org: Doc<"organizations">;
    subscriptions: Doc<"subscriptions">[];
  } | null> => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) =>
        index.eq("clerkOrgId", args.clerkOrgId),
      )
      .unique();
    if (!org || org.deletedAt !== undefined) return null;
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (index) => index.eq("orgId", args.clerkOrgId))
      .collect();
    return { org, subscriptions };
  },
});

/**
 * Persists the Stripe customer id on the org row. Called the first time we
 * create a Stripe customer for an org — every subsequent billing call reuses
 * the stored id instead of creating a duplicate customer.
 */
export const setStripeCustomerId = internalMutation({
  args: { clerkOrgId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) =>
        index.eq("clerkOrgId", args.clerkOrgId),
      )
      .unique();
    if (!org) return;
    if (org.stripeCustomerId === args.stripeCustomerId) return;
    await ctx.db.patch(org._id, { stripeCustomerId: args.stripeCustomerId });
  },
});

/**
 * Upserts a subscription row from a Stripe object. Idempotent — webhook
 * deliveries are at-least-once and Stripe events can arrive out of order, so
 * we always replace the whole snapshot rather than diffing.
 */
export const upsertSubscriptionFromStripe = internalMutation({
  args: {
    orgId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    plan: PLAN_VALIDATOR,
    status: STATUS_VALIDATOR,
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        orgId: args.orgId,
        stripeCustomerId: args.stripeCustomerId,
        plan: args.plan,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      });
      return existing._id;
    }
    return await ctx.db.insert("subscriptions", args);
  },
});

/**
 * Marks a subscription as canceled in response to `customer.subscription.deleted`.
 * We keep the row (history) but flip the status so `getEffectivePlan` falls
 * back to the next-best plan (or `essential`).
 */
export const markSubscriptionCanceled = internalMutation({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, {
      status: "canceled",
      cancelAtPeriodEnd: false,
    });
  },
});
