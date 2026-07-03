import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import { normalizePhone } from "./lib/phone";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";

const MAX_RESULTS = 200;
// Safety cap on how many client rows a single phone search will scan. Phone
// matching is a substring test that no index supports, so we stream the org's
// clients and filter in JS — bounded here so a huge org can't blow the query's
// read budget. If a shop ever exceeds this we should move phone search to a
// dedicated indexed `clientPhones` table (see the scaling plan).
const MAX_PHONE_SCAN = 10_000;

/**
 * Stream the org's clients (in `by_org` order) and collect up to `MAX_RESULTS`
 * whose primary or alt phone contains `digits`. Stops early once enough matches
 * are found or `MAX_PHONE_SCAN` rows have been examined. Unlike a `.take(200)`
 * prefilter, this considers EVERY client (up to the scan cap), so matches
 * aren't limited to the oldest 200 rows.
 */
async function scanPhoneMatches(
  ctx: QueryCtx,
  orgId: string,
  digits: string,
  includeArchived: boolean,
): Promise<Doc<"clients">[]> {
  const matches: Doc<"clients">[] = [];
  let scanned = 0;
  for await (const row of ctx.db
    .query("clients")
    .withIndex("by_org", (index) => index.eq("orgId", orgId))) {
    if (scanned >= MAX_PHONE_SCAN) break;
    scanned += 1;
    const visible = includeArchived || row.deletedAt === undefined;
    if (visible && phoneMatches(row, digits)) {
      matches.push(row);
      if (matches.length >= MAX_RESULTS) break;
    }
  }
  return matches.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Lists or searches clients in the caller's org.
 * - `staff+` can read.
 * - When `search` is a digit-only string (e.g. "5550100" or "4231"), the route
 *   walks the bounded `by_org` index and filters on `phoneDigits.includes(...)`
 *   so callers can find a client by phone number or just the last few digits.
 * - When `search` contains letters, uses the `search_name` fuzzy index on
 *   `fullName`.
 * - `includeArchived=false` (default) hides soft-deleted rows.
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const orgId = identity.orgId;
    const search = args.search?.trim();

    if (search && search.length > 0) {
      const digitsOnly = search.replace(/\D/g, "");
      const isDigitQuery = digitsOnly.length > 0 && digitsOnly === search;
      if (isDigitQuery) {
        return await scanPhoneMatches(
          ctx,
          orgId,
          digitsOnly,
          args.includeArchived ?? false,
        );
      }
      return await ctx.db
        .query("clients")
        .withSearchIndex("search_name", (index) =>
          args.includeArchived
            ? index.search("fullName", search).eq("orgId", orgId)
            : index
                .search("fullName", search)
                .eq("orgId", orgId)
                .eq("deletedAt", undefined),
        )
        .take(MAX_RESULTS);
    }
    const rows = await ctx.db
      .query("clients")
      .withIndex("by_org", (index) => index.eq("orgId", orgId))
      .take(MAX_RESULTS);
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => row.deletedAt === undefined);
    return filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

/**
 * Returns every client in the org enriched with their pets and the most-recent
 * appointment, for the clients board table. Bounded at `MAX_RESULTS` clients
 * and each row's pets / last-appointment lookups use indexes, so the worst-case
 * shape is `MAX_RESULTS × 2` indexed reads — fine for the dashboard scale we
 * target. UI is responsible for the search filter (we already debounce there).
 *
 * Search rules mirror `list()` so the same search box drives the same matching:
 * digit-only queries match phone digits; text queries use the fuzzy name index.
 */
export const listWithPets = query({
  args: {
    search: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const orgId = identity.orgId;
    const search = args.search?.trim();

    let clients: Array<Doc<"clients">>;
    if (search && search.length > 0) {
      const digitsOnly = search.replace(/\D/g, "");
      const isDigitQuery = digitsOnly.length > 0 && digitsOnly === search;
      if (isDigitQuery) {
        clients = await scanPhoneMatches(
          ctx,
          orgId,
          digitsOnly,
          args.includeArchived ?? false,
        );
      } else {
        clients = await ctx.db
          .query("clients")
          .withSearchIndex("search_name", (index) =>
            args.includeArchived
              ? index.search("fullName", search).eq("orgId", orgId)
              : index
                  .search("fullName", search)
                  .eq("orgId", orgId)
                  .eq("deletedAt", undefined),
          )
          .take(MAX_RESULTS);
      }
    } else {
      const rows = await ctx.db
        .query("clients")
        .withIndex("by_org", (index) => index.eq("orgId", orgId))
        .take(MAX_RESULTS);
      const filtered = args.includeArchived
        ? rows
        : rows.filter((row) => row.deletedAt === undefined);
      clients = filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    return await Promise.all(
      clients.map(async (client) => {
        const pets = await ctx.db
          .query("pets")
          .withIndex("by_client", (index) => index.eq("clientId", client._id))
          .take(20);
        const visiblePets = pets.filter((pet) => pet.deletedAt === undefined);

        // Most recent appointment for the client. `by_client` isn't ordered by
        // time, so we cap a recent window and pick the latest in JS — keeps the
        // scan bounded.
        const recentAppointments = await ctx.db
          .query("appointments")
          .withIndex("by_client", (index) => index.eq("clientId", client._id))
          .take(50);
        const lastAppointment = recentAppointments
          .sort((a, b) => b.startTime - a.startTime)
          .find(() => true) ?? null;

        return {
          client,
          pets: visiblePets,
          lastAppointment: lastAppointment
            ? {
                startTime: lastAppointment.startTime,
                status: lastAppointment.status,
              }
            : null,
        };
      }),
    );
  },
});

/**
 * Fetch a single client by id. Refuses cross-org IDs.
 */
export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    return await loadOwnClient(ctx, args.id, identity.orgId);
  },
});

const clientInputValidator = {
  fullName: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  phone: v.optional(v.string()),
  altPhones: v.optional(v.array(v.string())),
  email: v.optional(v.string()),
  addressLine1: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  country: v.optional(v.string()),
  notes: v.optional(v.string()),
};

function buildClientPatch(args: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  altPhones?: string[];
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}) {
  const normalizedPhone = normalizePhone(args.phone);
  const phone = normalizedPhone || undefined;
  const firstName = args.firstName?.trim() || undefined;
  const lastName = args.lastName?.trim() || undefined;
  // `fullName` is the canonical display + search string; derive it from
  // first/last when those are supplied. Falls back to the caller-supplied
  // `fullName` so legacy form submissions (no split fields) still work.
  const composed = [firstName, lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();
  const fullName =
    composed.length > 0
      ? composed
      : (args.fullName?.trim() || "");
  // Alt phones: normalized (7-digit → +613, 11-digit/leading-1 → strip),
  // de-duped, primary number excluded so we don't double-count it.
  // Empty array collapses to undefined for cleaner reads.
  const altPhonesDigits = (args.altPhones ?? [])
    .map((value) => normalizePhone(value))
    .filter((value) => value.length > 0 && value !== phone);
  const altPhones = Array.from(new Set(altPhonesDigits));
  return {
    fullName,
    firstName,
    lastName,
    phone,
    altPhones: altPhones.length > 0 ? altPhones : undefined,
    email: args.email?.trim() || undefined,
    addressLine1: args.addressLine1?.trim() || undefined,
    addressLine2: args.addressLine2?.trim() || undefined,
    city: args.city?.trim() || undefined,
    state: args.state?.trim() || undefined,
    postalCode: args.postalCode?.trim() || undefined,
    country: args.country?.trim() || undefined,
    notes: args.notes?.trim() || undefined,
  };
}

/**
 * True when the client's primary phone OR any altPhone contains the
 * caller-supplied digit query as a substring (so partial-match search
 * works — e.g. "4231" matches "555-555-4231"). Both fields are digit-
 * normalized before comparison.
 */
function phoneMatches(row: Doc<"clients">, digits: string): boolean {
  if (digits.length === 0) return false;
  const primary = (row.phone ?? "").replace(/\D/g, "");
  if (primary.includes(digits)) return true;
  for (const alt of row.altPhones ?? []) {
    if (alt.replace(/\D/g, "").includes(digits)) return true;
  }
  return false;
}

/**
 * Create a client. Admin + superAdmin only.
 */
export const create = mutation({
  args: clientInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    validateInput(args);
    return await ctx.db.insert("clients", {
      orgId,
      ...buildClientPatch(args),
    });
  },
});

/**
 * Update an existing client. Admin + superAdmin only. Refuses cross-org IDs.
 */
export const update = mutation({
  args: { id: v.id("clients"), ...clientInputValidator },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnClient(ctx, args.id, orgId);
    validateInput(args);
    await ctx.db.patch(existing._id, buildClientPatch(args));
  },
});

/**
 * Soft-delete a client (sets `deletedAt`). Cascade-archives their pets.
 * Appointment history that references this client stays readable.
 */
export const archive = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnClient(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return;
    const now = Date.now();
    await ctx.db.patch(existing._id, { deletedAt: now });
    const pets = await ctx.db
      .query("pets")
      .withIndex("by_client", (index) => index.eq("clientId", existing._id))
      .collect();
    for (const pet of pets) {
      if (pet.deletedAt === undefined) {
        await ctx.db.patch(pet._id, { deletedAt: now });
      }
    }
  },
});

/**
 * Restore a previously archived client. Admin + superAdmin.
 * Does NOT auto-restore pets — owners may want to bring a pet back individually.
 */
export const restore = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnClient(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return;
    await ctx.db.patch(existing._id, { deletedAt: undefined });
  },
});

/**
 * Permanently delete a client AND all their pets. superAdmin only.
 * Historical appointment rows that reference them will be orphaned.
 */
export const hardDelete = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnClient(ctx, args.id, orgId);
    const pets = await ctx.db
      .query("pets")
      .withIndex("by_client", (index) => index.eq("clientId", existing._id))
      .collect();
    for (const pet of pets) {
      if (pet.imageStorageId) {
        await ctx.storage.delete(pet.imageStorageId);
      }
      await ctx.db.delete(pet._id);
    }
    // Cascade signed consent records + their PDF + signature storage files.
    // Each row carries two `_storage` ids that must be cleaned before the
    // row is gone or we'd orphan files in Convex storage forever.
    const consents = await ctx.db
      .query("signedConsents")
      .withIndex("by_client", (index) => index.eq("clientId", existing._id))
      .collect();
    for (const row of consents) {
      await ctx.storage.delete(row.signatureStorageId);
      await ctx.storage.delete(row.pdfStorageId);
      await ctx.db.delete(row._id);
    }
    // Cascade legacy / imported appointment history rows.
    const legacy = await ctx.db
      .query("legacyAppointments")
      .withIndex("by_client", (index) => index.eq("clientId", existing._id))
      .collect();
    for (const row of legacy) await ctx.db.delete(row._id);
    await ctx.db.delete(existing._id);
  },
});

async function loadOwnClient(
  ctx: QueryCtx | MutationCtx,
  id: Id<"clients">,
  orgId: string,
): Promise<Doc<"clients">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

function validateInput(args: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): void {
  // Accept either `fullName` (legacy single-field forms) OR `firstName`
  // (new split-name forms). One of them must produce a non-empty trimmed
  // string; otherwise we'd insert a blank client record.
  const directName = args.fullName?.trim() ?? "";
  const composed = [args.firstName, args.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  if (directName.length === 0 && composed.length === 0) {
    appError("VALIDATION", { field: "fullName", reason: "REQUIRED" });
  }
  if (args.email !== undefined) {
    const email = args.email.trim();
    if (email.length > 0 && !email.includes("@")) {
      appError("VALIDATION", { field: "email", reason: "INVALID" });
    }
  }
}
