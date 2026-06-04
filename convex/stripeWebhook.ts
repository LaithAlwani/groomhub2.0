/**
 * Bridge between the Next.js webhook handler at
 * `app/api/stripe/webhook/route.ts` and the V8 internal mutations that own the
 * subscriptions table.
 *
 * Why a public-mutation-with-shared-secret pattern? Convex's
 * `ConvexHttpClient` can only call public functions, but we don't want a real
 * public surface for these — they should only be invoked by the Next.js
 * webhook route after it has verified the Stripe signature. The
 * `STRIPE_WEBHOOK_BRIDGE_SECRET` is a random string the Next.js route knows
 * (from `.env.local`) and Convex knows (from `npx convex env set`); the
 * mutation refuses any call where the secret doesn't match.
 *
 * The mutations are idempotent — Stripe webhook deliveries are at-least-once
 * and events can arrive out of order, so we always replace the snapshot
 * rather than diffing.
 */

import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

type Plan = "essential" | "professional" | "enterprise";

function verifyBridgeSecret(provided: string): void {
  const expected = process.env.STRIPE_WEBHOOK_BRIDGE_SECRET;
  if (!expected) {
    throw new ConvexError({
      code: "CONFIG",
      reason: "STRIPE_WEBHOOK_BRIDGE_SECRET missing in Convex env",
    });
  }
  if (!constantTimeEqual(provided, expected)) {
    throw new ConvexError({ code: "FORBIDDEN", reason: "BAD_BRIDGE_SECRET" });
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function tierForPriceId(priceId: string): Plan | null {
  if (priceId === process.env.STRIPE_PRICE_ESSENTIAL) return "essential";
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return "professional";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return null;
}

/**
 * Handles `customer.subscription.created` and `customer.subscription.updated`.
 * The Next.js route normalizes the Stripe event to these primitives before
 * calling — the bridge stays unaware of the SDK's object shape.
 */
export const applySubscriptionUpsert = mutation({
  args: {
    bridgeSecret: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: STATUS_VALIDATOR,
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    priceId: v.string(),
    clerkOrgId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"subscriptions"> | null> => {
    verifyBridgeSecret(args.bridgeSecret);

    const plan = tierForPriceId(args.priceId);
    if (!plan) {
      // Unknown price (someone manually attached an unrelated Price to the
      // sub in the Stripe Dashboard). Refuse rather than guess — the admin
      // can inspect via Stripe and fix.
      throw new ConvexError({
        code: "VALIDATION",
        reason: "UNKNOWN_PRICE_ID",
        priceId: args.priceId,
      });
    }

    // We expect `clerkOrgId` in the subscription metadata, set by
    // `createSubscription` when our app originated this Stripe row. Refusing
    // when it's missing forces operators to fix subs that were created
    // out-of-band in the Stripe Dashboard rather than silently mis-attributing
    // them.
    if (!args.clerkOrgId) {
      throw new ConvexError({
        code: "VALIDATION",
        reason: "MISSING_CLERK_ORG_METADATA",
        stripeSubscriptionId: args.stripeSubscriptionId,
      });
    }
    const orgId = args.clerkOrgId;

    return await ctx.runMutation(
      internal.stripeInternal.upsertSubscriptionFromStripe,
      {
        orgId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId,
        plan,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      },
    );
  },
});

/**
 * Handles `customer.subscription.deleted`. Flips the existing row to
 * `canceled` — the row itself stays for history.
 */
export const applySubscriptionDeleted = mutation({
  args: {
    bridgeSecret: v.string(),
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    verifyBridgeSecret(args.bridgeSecret);
    await ctx.runMutation(internal.stripeInternal.markSubscriptionCanceled, {
      stripeSubscriptionId: args.stripeSubscriptionId,
    });
  },
});

