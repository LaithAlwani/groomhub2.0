/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as availability from "../availability.js";
import type * as clerkSync from "../clerkSync.js";
import type * as clients from "../clients.js";
import type * as consentForms from "../consentForms.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as emailPayloads from "../emailPayloads.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as invitations from "../invitations.js";
import type * as lib_appointmentChecks from "../lib/appointmentChecks.js";
import type * as lib_ensureMembership from "../lib/ensureMembership.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_reservedSlugs from "../lib/reservedSlugs.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_seedFixtures from "../lib/seedFixtures.js";
import type * as lib_seedGating from "../lib/seedGating.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as lib_verifyWebhook from "../lib/verifyWebhook.js";
import type * as locationHours from "../locationHours.js";
import type * as locations from "../locations.js";
import type * as memberships from "../memberships.js";
import type * as onboarding from "../onboarding.js";
import type * as orgCleanup from "../orgCleanup.js";
import type * as organizations from "../organizations.js";
import type * as pets from "../pets.js";
import type * as seed from "../seed.js";
import type * as services from "../services.js";
import type * as stripe from "../stripe.js";
import type * as stripeInternal from "../stripeInternal.js";
import type * as stripeWebhook from "../stripeWebhook.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";
import type * as vaccines from "../vaccines.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  availability: typeof availability;
  clerkSync: typeof clerkSync;
  clients: typeof clients;
  consentForms: typeof consentForms;
  crons: typeof crons;
  dashboard: typeof dashboard;
  email: typeof email;
  emailPayloads: typeof emailPayloads;
  http: typeof http;
  imports: typeof imports;
  invitations: typeof invitations;
  "lib/appointmentChecks": typeof lib_appointmentChecks;
  "lib/ensureMembership": typeof lib_ensureMembership;
  "lib/errors": typeof lib_errors;
  "lib/phone": typeof lib_phone;
  "lib/plans": typeof lib_plans;
  "lib/rbac": typeof lib_rbac;
  "lib/reservedSlugs": typeof lib_reservedSlugs;
  "lib/roles": typeof lib_roles;
  "lib/seedFixtures": typeof lib_seedFixtures;
  "lib/seedGating": typeof lib_seedGating;
  "lib/tenant": typeof lib_tenant;
  "lib/verifyWebhook": typeof lib_verifyWebhook;
  locationHours: typeof locationHours;
  locations: typeof locations;
  memberships: typeof memberships;
  onboarding: typeof onboarding;
  orgCleanup: typeof orgCleanup;
  organizations: typeof organizations;
  pets: typeof pets;
  seed: typeof seed;
  services: typeof services;
  stripe: typeof stripe;
  stripeInternal: typeof stripeInternal;
  stripeWebhook: typeof stripeWebhook;
  subscriptions: typeof subscriptions;
  users: typeof users;
  vaccines: typeof vaccines;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
