/**
 * Stripe webhook receiver.
 *
 * Runs in Node so we can use the Stripe SDK's `webhooks.constructEvent`
 * helper for signature verification (timing-safe, tolerance window for
 * replay attacks). Once verified, normalizes the event into the primitives
 * the Convex bridge mutations expect and forwards them — Convex doesn't see
 * raw Stripe objects.
 *
 * Required env vars (`.env.local` for dev, Vercel project env for prod):
 *   STRIPE_SECRET_KEY              — for the SDK constructor
 *   STRIPE_WEBHOOK_SECRET          — signing secret for THIS endpoint
 *                                    (from `stripe listen` in dev, or the
 *                                    dashboard webhook page in prod)
 *   STRIPE_WEBHOOK_BRIDGE_SECRET   — shared with Convex env so this route is
 *                                    the only thing that can write subs
 *   NEXT_PUBLIC_CONVEX_URL         — already set; the Convex deployment URL
 *
 * Subscribed Stripe events:
 *   customer.subscription.created   → upserts a row
 *   customer.subscription.updated   → upserts (tier change, cancel-at-period
 *                                     toggle, status change)
 *   customer.subscription.deleted   → flips status to canceled
 *   invoice.paid / invoice.payment_failed are informational — the
 *   subscription.updated alongside carries the auth state we care about.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const TRACKED_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const bridgeSecret = process.env.STRIPE_WEBHOOK_BRIDGE_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!secretKey || !webhookSecret || !bridgeSecret || !convexUrl) {
    console.error("Stripe webhook: missing required env vars");
    return new NextResponse("Server not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });

  const rawBody = await request.text();
  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (caught) {
    console.warn(
      "Stripe webhook: signature verification failed",
      caught instanceof Error ? caught.message : caught,
    );
    return new NextResponse("Bad signature", { status: 400 });
  }

  const convex = new ConvexHttpClient(convexUrl);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const item = subscription.items.data[0];
        if (!item) {
          console.warn("Subscription has no items, skipping:", subscription.id);
          break;
        }
        if (!TRACKED_STATUSES.has(subscription.status)) {
          console.warn(
            "Subscription status not in tracked set, skipping:",
            subscription.status,
            subscription.id,
          );
          break;
        }
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        // In Stripe API 2025-04+ `current_period_end` lives on each item, not
        // on the subscription itself. We read from the item; for our
        // single-item subs it's the canonical period end.
        const periodEndSeconds = (
          item as { current_period_end?: number }
        ).current_period_end;
        if (!periodEndSeconds) {
          console.warn(
            "Subscription item missing current_period_end:",
            subscription.id,
          );
          break;
        }
        await convex.mutation(api.stripeWebhook.applySubscriptionUpsert, {
          bridgeSecret,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          status: subscription.status as
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "incomplete"
            | "incomplete_expired"
            | "unpaid"
            | "paused",
          currentPeriodEnd: periodEndSeconds * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          priceId: item.price.id,
          clerkOrgId: subscription.metadata?.clerkOrgId ?? undefined,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await convex.mutation(api.stripeWebhook.applySubscriptionDeleted, {
          bridgeSecret,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }
      default:
        break;
    }
  } catch (caught) {
    console.error(
      "Stripe webhook bridge failed for",
      event.type,
      event.id,
      caught instanceof Error ? caught.message : caught,
    );
    return new NextResponse("Bridge error", { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
