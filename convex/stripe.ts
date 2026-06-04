"use node";

/**
 * Stripe Billing actions for the SaaS subscription flow.
 *
 * Runs on Node so we can import the `stripe` SDK. V8 helpers in
 * `convex/stripeInternal.ts` own the db side; this file is the bridge between
 * Convex db and Stripe's API. Webhook event persistence lives separately in
 * `convex/stripeWebhook.ts`.
 *
 * Required Convex env vars (set with `npx convex env set NAME value`):
 *   STRIPE_SECRET_KEY               — sk_test_... / sk_live_...
 *   STRIPE_PRICE_ESSENTIAL          — price_... for the $49 CAD monthly Price
 *   STRIPE_PRICE_PROFESSIONAL       — price_... for $99 CAD monthly
 *   STRIPE_PRICE_ENTERPRISE         — price_... for $179 CAD monthly
 *
 * Caller contract: every action requires the caller to be an admin or
 * superAdmin of the org they're billing. Staff cannot manage billing.
 */

import { v, ConvexError } from "convex/values";
import Stripe from "stripe";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mapClerkOrgRole } from "./lib/roles";

type Plan = "essential" | "professional" | "enterprise";

const PLAN_LITERAL = v.union(
  v.literal("essential"),
  v.literal("professional"),
  v.literal("enterprise"),
);

const ACTIVE_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "incomplete",
]);

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new ConvexError({
      code: "CONFIG",
      reason: "STRIPE_SECRET_KEY missing in Convex env",
    });
  }
  return new Stripe(key);
}

function priceIdForTier(tier: Plan): string {
  const map: Record<Plan, string | undefined> = {
    essential: process.env.STRIPE_PRICE_ESSENTIAL,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  const id = map[tier];
  if (!id) {
    throw new ConvexError({
      code: "CONFIG",
      reason: `Missing STRIPE_PRICE_${tier.toUpperCase()} in Convex env`,
    });
  }
  return id;
}

/**
 * Asserts the caller is an admin or superAdmin of the active org. Returns the
 * Clerk orgId + caller email (used as the Stripe customer email when we have
 * to create one). Throws ConvexError on auth failure.
 */
async function requireBillingAdmin(
  ctx: ActionCtx,
): Promise<{ clerkOrgId: string; userEmail: string | undefined }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED" });
  const orgId =
    ((identity as Record<string, unknown>)["org_id"] as string | undefined) ??
    (identity.orgId as string | undefined);
  const orgRole =
    ((identity as Record<string, unknown>)["org_role"] as string | undefined) ??
    (identity.orgRole as string | undefined);
  if (!orgId || !orgRole) {
    throw new ConvexError({ code: "FORBIDDEN", reason: "NO_ORG_CONTEXT" });
  }
  const role = mapClerkOrgRole(orgRole);
  if (role !== "superAdmin" && role !== "admin") {
    throw new ConvexError({ code: "FORBIDDEN", reason: "ROLE_NOT_PERMITTED" });
  }
  return { clerkOrgId: orgId, userEmail: identity.email ?? undefined };
}

/**
 * Resolves the org's Stripe customer id, creating one on the fly if the org
 * has never been billed. Persists the new id to the org row so subsequent
 * calls (or webhooks) reuse it.
 */
async function ensureStripeCustomer(
  ctx: ActionCtx,
  clerkOrgId: string,
  email: string | undefined,
): Promise<string> {
  const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
    clerkOrgId,
  });
  if (!data) {
    throw new ConvexError({ code: "NOT_FOUND", reason: "ORG_NOT_FOUND" });
  }
  if (data.org.stripeCustomerId) return data.org.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: data.org.name,
    metadata: { clerkOrgId },
  });
  await ctx.runMutation(internal.stripeInternal.setStripeCustomerId, {
    clerkOrgId,
    stripeCustomerId: customer.id,
  });
  return customer.id;
}

/**
 * Creates a fresh subscription for the caller's org with
 * `payment_behavior: "default_incomplete"`. Returns the `clientSecret` of the
 * first invoice's PaymentIntent so the front-end can mount `<PaymentElement>`
 * and call `stripe.confirmPayment` to finish setup.
 *
 * Refuses if the org already has an active (`trialing|active|past_due|
 * incomplete`) subscription — the caller should use `updateSubscription`
 * instead to swap tiers.
 */
export const createSubscription = action({
  args: { tier: PLAN_LITERAL },
  handler: async (
    ctx,
    args,
  ): Promise<{ subscriptionId: string; clientSecret: string }> => {
    const { clerkOrgId, userEmail } = await requireBillingAdmin(ctx);
    const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
      clerkOrgId,
    });
    if (!data) {
      throw new ConvexError({ code: "NOT_FOUND", reason: "ORG_NOT_FOUND" });
    }
    const alreadyActive = data.subscriptions.find((subscription) =>
      ACTIVE_STATUSES.has(subscription.status),
    );
    if (alreadyActive) {
      throw new ConvexError({
        code: "CONFLICT",
        reason: "SUBSCRIPTION_ALREADY_ACTIVE",
        existingTier: alreadyActive.plan,
      });
    }

    const customerId = await ensureStripeCustomer(ctx, clerkOrgId, userEmail);
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceIdForTier(args.tier) }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: { clerkOrgId, tier: args.tier },
    });

    // In Stripe API 2025-04+ the per-invoice client secret lives on
    // `latest_invoice.confirmation_secret.client_secret`; older versions used
    // `latest_invoice.payment_intent.client_secret`. The SDK's TS types lag
    // the API in some versions, so we cast and read whichever is present.
    const invoice = subscription.latest_invoice as
      | (Stripe.Invoice & {
          confirmation_secret?: { client_secret?: string | null };
          payment_intent?: Stripe.PaymentIntent | string | null;
        })
      | null;
    const clientSecret =
      invoice?.confirmation_secret?.client_secret ??
      (invoice?.payment_intent && typeof invoice.payment_intent !== "string"
        ? invoice.payment_intent.client_secret
        : null);
    if (!clientSecret) {
      throw new ConvexError({
        code: "STRIPE",
        reason: "MISSING_CLIENT_SECRET",
      });
    }
    return { subscriptionId: subscription.id, clientSecret };
  },
});

/**
 * Swaps the active subscription to a different tier. Stripe handles proration
 * automatically (`create_prorations`) so the customer is charged or credited
 * for the unused portion of the current period. Webhook reconciles state.
 */
export const updateSubscription = action({
  args: { newTier: PLAN_LITERAL },
  handler: async (
    ctx,
    args,
  ): Promise<{ subscriptionId: string; status: string }> => {
    const { clerkOrgId } = await requireBillingAdmin(ctx);
    const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
      clerkOrgId,
    });
    if (!data) {
      throw new ConvexError({ code: "NOT_FOUND", reason: "ORG_NOT_FOUND" });
    }
    const active = data.subscriptions.find((subscription) =>
      ACTIVE_STATUSES.has(subscription.status),
    );
    if (!active) {
      throw new ConvexError({
        code: "NOT_FOUND",
        reason: "NO_ACTIVE_SUBSCRIPTION",
      });
    }
    if (active.plan === args.newTier) {
      return { subscriptionId: active.stripeSubscriptionId, status: active.status };
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      active.stripeSubscriptionId,
    );
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      throw new ConvexError({ code: "STRIPE", reason: "NO_SUBSCRIPTION_ITEM" });
    }
    const updated = await stripe.subscriptions.update(
      active.stripeSubscriptionId,
      {
        items: [{ id: itemId, price: priceIdForTier(args.newTier) }],
        proration_behavior: "create_prorations",
        metadata: { clerkOrgId, tier: args.newTier },
      },
    );
    return { subscriptionId: updated.id, status: updated.status };
  },
});

/**
 * Cancels the active subscription. `atPeriodEnd: true` (default) keeps the org
 * on its current tier until the period ends; `false` cancels immediately and
 * the org falls back to the trial / essential. Webhook reconciles state.
 */
export const cancelSubscription = action({
  args: { atPeriodEnd: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ status: string }> => {
    const { clerkOrgId } = await requireBillingAdmin(ctx);
    const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
      clerkOrgId,
    });
    if (!data) {
      throw new ConvexError({ code: "NOT_FOUND", reason: "ORG_NOT_FOUND" });
    }
    const active = data.subscriptions.find((subscription) =>
      ACTIVE_STATUSES.has(subscription.status),
    );
    if (!active) {
      throw new ConvexError({
        code: "NOT_FOUND",
        reason: "NO_ACTIVE_SUBSCRIPTION",
      });
    }
    const stripe = getStripe();
    const atPeriodEnd = args.atPeriodEnd ?? true;
    if (atPeriodEnd) {
      const updated = await stripe.subscriptions.update(
        active.stripeSubscriptionId,
        { cancel_at_period_end: true },
      );
      return { status: updated.status };
    }
    const canceled = await stripe.subscriptions.cancel(
      active.stripeSubscriptionId,
    );
    return { status: canceled.status };
  },
});

/**
 * Undoes a pending cancellation if the subscription is still active.
 */
export const resumeSubscription = action({
  args: {},
  handler: async (ctx): Promise<{ status: string }> => {
    const { clerkOrgId } = await requireBillingAdmin(ctx);
    const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
      clerkOrgId,
    });
    if (!data) {
      throw new ConvexError({ code: "NOT_FOUND", reason: "ORG_NOT_FOUND" });
    }
    const active = data.subscriptions.find(
      (subscription) =>
        ACTIVE_STATUSES.has(subscription.status) &&
        subscription.cancelAtPeriodEnd === true,
    );
    if (!active) {
      throw new ConvexError({
        code: "NOT_FOUND",
        reason: "NO_CANCELING_SUBSCRIPTION",
      });
    }
    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(
      active.stripeSubscriptionId,
      { cancel_at_period_end: false },
    );
    return { status: updated.status };
  },
});

/**
 * Returns a fresh SetupIntent client secret so the UI can mount a
 * `<PaymentElement>` for updating the org's payment method. The new card is
 * attached to the customer and (via `customer.invoice_settings`) becomes the
 * default for future invoices.
 */
export const createSetupIntent = action({
  args: {},
  handler: async (ctx): Promise<{ clientSecret: string }> => {
    const { clerkOrgId, userEmail } = await requireBillingAdmin(ctx);
    const customerId = await ensureStripeCustomer(ctx, clerkOrgId, userEmail);
    const stripe = getStripe();
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });
    if (!intent.client_secret) {
      throw new ConvexError({
        code: "STRIPE",
        reason: "MISSING_CLIENT_SECRET",
      });
    }
    return { clientSecret: intent.client_secret };
  },
});

/**
 * Returns the current default payment method (last4 + brand) for the UI's
 * "Payment method" section. Returns null if the customer has none yet
 * (e.g. they're still in trial and haven't subscribed).
 */
export const getPaymentMethod = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ brand: string; last4: string; expMonth: number; expYear: number } | null> => {
    const { clerkOrgId } = await requireBillingAdmin(ctx);
    const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
      clerkOrgId,
    });
    if (!data || !data.org.stripeCustomerId) return null;
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(data.org.stripeCustomerId);
    if (customer.deleted) return null;
    const pmId = (customer as Stripe.Customer).invoice_settings
      ?.default_payment_method;
    if (!pmId || typeof pmId !== "string") return null;
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (!pm.card) return null;
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  },
});

/**
 * Returns the org's recent invoices for the billing page's history section.
 * `hostedInvoiceUrl` opens Stripe's hosted invoice view; `invoicePdf` is a
 * direct PDF download. Both are unavoidable Stripe-hosted URLs — the rest of
 * the billing UI stays inside our app chrome.
 */
export const listInvoices = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      id: string;
      number: string | null;
      amountPaid: number;
      currency: string;
      status: string | null;
      created: number;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
    }>
  > => {
    const { clerkOrgId } = await requireBillingAdmin(ctx);
    const data = await ctx.runQuery(internal.stripeInternal.getOrgForBilling, {
      clerkOrgId,
    });
    if (!data || !data.org.stripeCustomerId) return [];
    const stripe = getStripe();
    const invoices = await stripe.invoices.list({
      customer: data.org.stripeCustomerId,
      limit: 12,
    });
    return invoices.data.map((invoice) => ({
      id: invoice.id ?? "",
      number: invoice.number ?? null,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status ?? null,
      created: invoice.created * 1000,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
    }));
  },
});
