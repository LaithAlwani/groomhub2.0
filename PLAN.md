# GroomHub Payments + Plan Feature Matrix

> Living source of truth for the SaaS billing rollout. Edit here when scope, tiers, or pricing change. Lives in git so it's portable across workstations and visible to the team.

## Context

This file replaces the absence of a roadmap doc. It captures the next phase: turning the existing tier scaffolding into a real, billable product.

**Decisions:**
- **Phase 1 scope**: SaaS subscription billing only (orgs paying $49/$99/$179/mo).
- **Provider**: **Stripe** for SaaS billing. In-app appointment payments deferred to Phase 3 — choosing Stripe now does NOT block adding Square (or another POS) later, since SaaS billing and marketplace payments are independent integrations on independent accounts.
- **Region**: Canada only at launch. CAD currency. Stripe Tax handles GST/HST/PST.
- **UI**: Stripe Elements (`<PaymentElement>`) rendered **inside our own page chrome** — no redirect to Stripe-hosted Checkout, no Stripe-hosted Customer Portal. We build the management UI ourselves on top of the Stripe APIs.
- **Marketing matrix cleanup**: Keep **SMS reminders (coming soon)** on all 3 tiers with monthly caps + paid addons. Drop entirely from marketing: recurring appointments, inventory tracking, workflow automation, API access, centralized management dashboard, and the public online booking portal (not built, not promising it).
- **SMS caps**: Essential 300/mo, Professional 700/mo, Enterprise 1000/mo. Paid addons: $19.99 → +1000 messages, $39.99 → +2500 messages. Addon purchase + metering ship in Phase 2 with SMS itself; Phase 1 only advertises the caps.

## Why Stripe (short version)

| | Stripe | Square |
|---|---|---|
| Embeddable subscription UI (Payment Element, Embedded Checkout) | first-class | Web Payments SDK is card-focused, not subscription-focused |
| SaaS subscription DX | industry standard | POS-first |
| CAD + Stripe Tax (GST/HST/PST) | native | workable |
| TS SDK quality | first-class | ok |
| Doesn't preclude Square later | different flow | n/a |

Square is only worth picking if a majority of target salons already swipe cards on Square POS and want one merchant account — that's a Phase 3 question.

## Final tier matrix

Marketing copy in `lib/landingPage.ts` will be revised to this. Backend gates added to match.

| Feature | Essential ($49) | Professional ($99) | Enterprise ($179) | Status |
|---|---|---|---|---|
| Booking calendar | yes | yes | yes | shipped |
| Email reminders | yes | yes | yes | shipped |
| Customer/pet profiles + history | yes | yes | yes | shipped |
| Basic reports | yes | yes | yes | shipped |
| Staff accounts (cap) | up to 2 | up to 6 | unlimited | **needs gate** |
| Role-based staff permissions | — | yes | yes | shipped, **needs gate** |
| Salon health dashboard | — | yes | yes | shipped + gated |
| SMS reminders | 300/mo (soon) | 700/mo (soon) | 1000/mo (soon) | **not built** |
| Multiple locations | — | — | yes | shipped + gated |
| Advanced analytics (top services/clients) | — | — | yes | shipped + gated |
| Priority support | email | priority email | priority phone | process |

**SMS addons (advertised, billed later in Phase 2 when SMS ships):**
- +1000 messages/mo for $19.99
- +2500 messages/mo for $39.99

**Dropped from marketing copy:** recurring appointments, inventory tracking, workflow automation, API & integrations access, centralized management dashboard, and the public online booking portal. The current product only supports in-app booking by admins/staff in `app/(app)/calendar/`. A public-facing `/{orgSlug}/...` booking portal exists only as a schema reservation today — not on this plan's runway.

## Implementation plan

### Step 1 — Marketing copy revision (no backend)
File: `lib/landingPage.ts` `pricing.tiers`
- **Essential**: keep current list; add `"SMS reminders — 300/mo (coming soon)"`.
- **Professional**: replace `"SMS & email reminders"` with `"SMS reminders — 700/mo (coming soon)"`. **Remove** `"Online booking system"`, `"Recurring appointments"`, `"Inventory tracking"`, `"Workflow automation"`. Add `"Salon health dashboard"`.
- **Enterprise**: **remove** `"API & integrations access"`, `"Centralized management dashboard"`. Confirm `"Multiple locations"`, `"Advanced analytics & reporting"`, `"Priority phone support"`. Add `"SMS reminders — 1000/mo (coming soon)"`.
- Add a small note below the pricing grid: `"Need more SMS? +1000 messages for $19.99 or +2500 for $39.99 — available when SMS launches."`

### Step 2 — Schema + plan-helper changes
File: `convex/schema.ts`
- Add `subscriptions` table:
  ```ts
  subscriptions: defineTable({
    orgId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    plan: v.union(v.literal("essential"), v.literal("professional"), v.literal("enterprise")),
    status: v.union(
      v.literal("trialing"), v.literal("active"), v.literal("past_due"),
      v.literal("canceled"), v.literal("incomplete"), v.literal("incomplete_expired"),
      v.literal("unpaid"), v.literal("paused"),
    ),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),
  ```
- Add `trialEndsAt: v.optional(v.number())` to `organizations`.

File: `convex/clerkSync.ts`
- At org creation: set `trialEndsAt = now + 14 days` and keep `plan = "essential"` (effective plan during trial is computed).

File: `convex/lib/plans.ts`
- Extract `getEffectivePlan(ctx, orgClerkId)` — returns:
  - `"professional"` if `org.trialEndsAt > now` (trial users get Pro features),
  - else most recent active subscription's plan,
  - else `"essential"`.
- Expose `getStaffCap(plan): number | null` (2 / 6 / null).
- Add `rolePermissions` to `PlanFeature` matrix → `professional` minimum.
- No `onlineBooking` gate (public portal out of scope).

File: `convex/memberships.ts` (or wherever invites are created)
- Before creating an invite/membership: check `count(activeMemberships) < getStaffCap(effectivePlan)`. Throw `PLAN_REQUIRED` with reason `STAFF_CAP_REACHED` if exceeded.

### Step 3 — Stripe Billing integration (UI inside our app — no redirects)

Install: `npm i stripe @stripe/stripe-js @stripe/react-stripe-js`

Env vars (`.env.example`):
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ESSENTIAL=
STRIPE_PRICE_PROFESSIONAL=
STRIPE_PRICE_ENTERPRISE=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

New Convex files:
- `convex/stripe.ts` — Node actions, all returning data (NOT URLs):
  - `createSubscription({ tier })` → creates Stripe customer if missing, creates Subscription with `payment_behavior: "default_incomplete"`, returns `{ subscriptionId, clientSecret }` for the SetupIntent/PaymentIntent. Front-end mounts `<PaymentElement>` and calls `stripe.confirmSetup`/`stripe.confirmPayment` on submit.
  - `updateSubscription({ newTier })` → `stripe.subscriptions.update()` with proration. Returns updated state.
  - `cancelSubscription({ atPeriodEnd })` → flips `cancel_at_period_end` (or immediate cancel).
  - `createSetupIntent()` → returns `clientSecret` for the "change payment method" Element.
  - `listInvoices()` → returns recent invoices (id, amount, status, hosted invoice URL for PDF download only).
- `convex/stripeWebhook.ts` — internal mutations: `upsertSubscriptionFromStripe`, `markSubscriptionCanceled`. Events handled: `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.

New Next.js + UI files:
- `app/api/stripe/webhook/route.ts` — verify signature with `stripe.webhooks.constructEvent`, call Convex internal mutation. `export const runtime = "nodejs"`.
- `app/(app)/settings/billing/page.tsx` — top-level billing page. Sections:
  1. **Current plan** card: tier name, status, trial countdown / next-bill date.
  2. **Plan switcher**: 3 tier cards — clicking "Switch to X" mounts an in-page modal with `<PaymentElement>` (new subscribers) or calls `updateSubscription` directly (existing subscribers, proration disclosed).
  3. **Payment method**: shows last4 + brand; "Update card" opens an in-page `<PaymentElement>` on a fresh SetupIntent.
  4. **Invoices** list: from `listInvoices`. Download links open the Stripe-hosted PDF in a new tab.
  5. **Cancel** button: in-app confirm dialog, calls `cancelSubscription({ atPeriodEnd: true })`.
  - Uses `max-w-7xl`. No back link.
- `components/billing/StripeElementsProvider.tsx` — wraps `<Elements stripe={stripePromise} options={{ clientSecret, appearance }}>` with a GroomHub-themed `appearance`.
- `components/billing/SubscribeForm.tsx`, `UpdateCardForm.tsx` — client components owning `<PaymentElement>` + submit handler.
- `components/billing/PlanSwitcher.tsx`, `InvoiceList.tsx`, `CurrentPlanCard.tsx` — pure UI, ≤200 lines each.

### Step 4 — Upgrade nudges polish

There is no centralized `PlanFeatureGate` component today. Upgrade nudges live at each call site of the `usePlanFeature` hook (`lib/usePlanFeature.ts`) and inside a couple of bespoke UI surfaces:

- `components/dashboard/LockedWidgetTeaser.tsx` — currently links to `/#pricing`. Update to `/settings/billing?highlight=<requiredPlan>`.
- `app/(app)/settings/locations/LocationsBody.tsx` — currently shows a static amber "Upgrade to Enterprise" banner with no link. Make the banner clickable, navigating to `/settings/billing?highlight=enterprise`.
- The billing page reads the `highlight` search param, scrolls to that tier's card, and (for non-subscribers) pre-opens the in-page subscribe modal.

Sidebar: small banner during trial showing "X days left of free trial." Hide when subscription is active.

## Critical files

- `lib/landingPage.ts` — marketing copy revision
- `convex/schema.ts` — `subscriptions` table, `organizations.trialEndsAt`
- `convex/lib/plans.ts` — `getEffectivePlan`, staff-cap helper, expanded matrix
- `convex/clerkSync.ts` — set `trialEndsAt` at org creation
- `convex/memberships.ts` — staff-cap enforcement
- `components/dashboard/LockedWidgetTeaser.tsx` — deep-link upgrade CTA
- `app/(app)/settings/locations/LocationsBody.tsx` — clickable upgrade banner
- New Convex: `convex/stripe.ts`, `convex/stripeWebhook.ts`
- New Next routes: `app/api/stripe/webhook/route.ts`, `app/(app)/settings/billing/page.tsx`
- New billing components: `components/billing/StripeElementsProvider.tsx`, `SubscribeForm.tsx`, `UpdateCardForm.tsx`, `PlanSwitcher.tsx`, `InvoiceList.tsx`, `CurrentPlanCard.tsx`
- `package.json`, `.env.example`

## Existing utilities to reuse

- `requirePlanFeature(ctx, orgClerkId, feature)` in `convex/lib/plans.ts` — keep the throwing contract, swap the plan source.
- `appError("PLAN_REQUIRED", { … })` in `convex/lib/errors.ts` — already understood by client gate.
- `components/ui/PlanFeatureGate.tsx` + `lib/usePlanFeature.ts` — already wrap features with upgrade nudges; we just deep-link the CTA.
- `convex/clerkSync.ts` — canonical onboarding side-effect site; trial bootstrap belongs here.

## Verification

End-to-end against Stripe **test mode**:

1. Sign up a brand-new org → `trialEndsAt ≈ now + 14d`, sidebar shows trial countdown, Pro features unlock.
2. `stripe listen --forward-to localhost:3000/api/stripe/webhook` then `/settings/billing` → "Switch to Professional" → in-page `<PaymentElement>` mounts → submit with `4242 4242 4242 4242`. Confirm: card form rendered inline (no redirect to checkout.stripe.com), webhook arrives, `subscriptions` row created with `status: active`.
3. Lock a Pro feature behind a free essential org (no sub, no trial) → `PLAN_REQUIRED` thrown, `PlanFeatureGate` renders the upgrade card; clicking navigates to `/settings/billing?highlight=professional` and pre-opens the in-page subscribe modal.
4. Invite a 3rd staff member on an Essential plan → staff-cap error.
5. On `/settings/billing`, switch Pro → Enterprise via the in-app plan switcher → proration disclosure, `customer.subscription.updated` flips `plan` in Convex, Enterprise features unlock without a page reload.
6. "Update card" → in-page `<PaymentElement>` mounted on a fresh SetupIntent → submit new test card. New last4 displayed without leaving the page.
7. "Cancel subscription" → in-app confirm dialog → `cancelAtPeriodEnd: true` set; org keeps Pro until `currentPeriodEnd`; after that downgrades to Essential.
8. Webhook idempotency: replay the same event ID twice via `stripe events resend` → no duplicate subscription rows / no state regression.
9. **Confirm no Stripe-hosted page is ever opened during the happy path** — only invoice PDF downloads (unavoidable) open externally.

## Stripe setup checklist (for the user, before Step 3 wiring)

Do this in the Stripe Dashboard while in **test mode**, then share the values:

1. **Create the account** (or log into the existing one). Set the country to Canada so CAD is the default.
2. **Create 3 recurring Products + Prices** (Billing → Products):
   - `GroomHub Essential` — recurring monthly — **$49.00 CAD**
   - `GroomHub Professional` — recurring monthly — **$99.00 CAD**
   - `GroomHub Enterprise` — recurring monthly — **$179.00 CAD**
   Copy each Price ID (looks like `price_…`). These map to `STRIPE_PRICE_ESSENTIAL`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE`.
3. **API keys** (Developers → API keys):
   - Copy the **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY` (server-only, never expose).
   - Copy the **Publishable key** (`pk_test_…`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. **Webhook secret for local dev**: install the Stripe CLI, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` — it will print a `whsec_…` value. → `STRIPE_WEBHOOK_SECRET`.
   - For deployed environments (Vercel preview / prod), create the webhook endpoint in the dashboard (Developers → Webhooks) and use its `whsec_…` there instead.
5. **(Optional, recommended)** Enable **Stripe Tax** for Canada so GST/HST/PST is collected automatically. Settings → Tax → enable. Add Canada as a registered region with your CRA number when you have it.
6. **Add values to two places**:
   - `.env.local` at repo root — for Next.js (`NEXT_PUBLIC_*` + the webhook route).
   - Convex dashboard env vars (Settings → Environment Variables) — for the Convex actions in `convex/stripe.ts`. Convex actions don't read Next.js env, they have their own env-var store.

Once those are set, ping the AI and Step 3 (install + wire) can proceed.

## Out of scope (explicit)

- In-app appointment payments (Phase 3 — Stripe-for-billing does NOT preclude Square-for-POS).
- Multi-currency (US, etc.) — Phase 2+ when expanding beyond CA.
- Building SMS reminders + addon billing/metering — Phase 2.
- Public online booking portal — not on this plan's runway, not advertised.
- Recurring appointments, inventory tracking, workflow automation, API access, centralized management dashboard — dropped from marketing, not on runway.
- Annual billing toggle — Stripe supports it, but ship monthly first.
