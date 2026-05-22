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
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_appointmentChecks from "../lib/appointmentChecks.js";
import type * as lib_ensureMembership from "../lib/ensureMembership.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_reservedSlugs from "../lib/reservedSlugs.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as lib_verifyWebhook from "../lib/verifyWebhook.js";
import type * as memberships from "../memberships.js";
import type * as organizations from "../organizations.js";
import type * as pets from "../pets.js";
import type * as services from "../services.js";
import type * as users from "../users.js";

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
  email: typeof email;
  http: typeof http;
  invitations: typeof invitations;
  "lib/appointmentChecks": typeof lib_appointmentChecks;
  "lib/ensureMembership": typeof lib_ensureMembership;
  "lib/errors": typeof lib_errors;
  "lib/rbac": typeof lib_rbac;
  "lib/reservedSlugs": typeof lib_reservedSlugs;
  "lib/roles": typeof lib_roles;
  "lib/tenant": typeof lib_tenant;
  "lib/verifyWebhook": typeof lib_verifyWebhook;
  memberships: typeof memberships;
  organizations: typeof organizations;
  pets: typeof pets;
  services: typeof services;
  users: typeof users;
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
