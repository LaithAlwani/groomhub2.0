import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import Fuse from "fuse.js";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import {
  altPhoneEntryValidator,
  phoneEntryLabel,
  phoneEntryNumber,
  phoneLabelValidator,
  phoneSearchDigits,
  toE164,
  type PhoneLabel,
  type StoredPhoneEntry,
} from "./lib/phone";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";

const MAX_RESULTS = 200;
// Safety cap on how many client rows a single phone search will scan. Phone
// matching is a substring test that no index supports, so we stream the org's
// clients and filter in JS — bounded here so a huge org can't blow the query's
// read budget. If a shop ever exceeds this we should move phone search to a
// dedicated indexed `clientPhones` table (see the scaling plan).
const MAX_PHONE_SCAN = 10_000;

// Fuzzy (typo-tolerant) name search. Convex's full-text index requires an exact
// match for short terms, so "mile" won't find "Mike". When the indexed search
// comes back thin we stream the org's clients + pets (bounded, like the phone
// scan) and rank them with Fuse.js. Only runs for thin results, so common
// queries stay index-fast.
const MAX_FUZZY_SCAN = 4_000; // per table (clients, pets)
const FUZZY_TRIGGER = 10; // run fuzzy only when the index returns fewer than this
const MIN_FUZZY_QUERY_LEN = 3; // 1–2 char queries are handled by prefix search
const FUZZY_THRESHOLD = 0.5; // Fuse: lower = stricter, higher = looser

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
 * Text search across clients: matches the client's own name (fuzzy `search_name`
 * index) UNION clients whose pet's name matches (the pets `search_name` index).
 * Deduped by client id; archived clients/pets hidden unless `includeArchived`.
 */
async function searchClientsByText(
  ctx: QueryCtx,
  orgId: string,
  search: string,
  includeArchived: boolean,
): Promise<Doc<"clients">[]> {
  const nameMatches = await ctx.db
    .query("clients")
    .withSearchIndex("search_name", (index) =>
      includeArchived
        ? index.search("fullName", search).eq("orgId", orgId)
        : index
            .search("fullName", search)
            .eq("orgId", orgId)
            .eq("deletedAt", undefined),
    )
    .take(MAX_RESULTS);

  const petMatches = await ctx.db
    .query("pets")
    .withSearchIndex("search_name", (index) =>
      includeArchived
        ? index.search("name", search).eq("orgId", orgId)
        : index
            .search("name", search)
            .eq("orgId", orgId)
            .eq("deletedAt", undefined),
    )
    .take(MAX_RESULTS);

  const byId = new Map<Id<"clients">, Doc<"clients">>();
  for (const client of nameMatches) byId.set(client._id, client);
  for (const pet of petMatches) {
    if (byId.has(pet.clientId)) continue;
    const client = await ctx.db.get(pet.clientId);
    if (!client || client.orgId !== orgId) continue;
    if (!includeArchived && client.deletedAt !== undefined) continue;
    byId.set(client._id, client);
  }

  // Typo fallback: the index misses transposed/substituted short terms
  // ("mile" ↛ "Mike"). Only when the indexed union is thin do we pay the scan.
  if (search.trim().length >= MIN_FUZZY_QUERY_LEN && byId.size < FUZZY_TRIGGER) {
    const fuzzy = await scanFuzzyMatches(
      ctx,
      orgId,
      search,
      includeArchived,
      new Set(byId.keys()),
    );
    for (const client of fuzzy) byId.set(client._id, client);
  }
  // Relevance order: index hits first (Convex-ranked), then fuzzy (Fuse-ranked).
  return Array.from(byId.values());
}

/** First whitespace-delimited token of a name (for boosting first-name hits). */
function firstToken(name: string): string {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

type FuzzyCandidate = { clientId: Id<"clients">; name: string; first: string };

/**
 * Fuzzy name fallback. Streams the org's clients + pets (bounded by
 * `MAX_FUZZY_SCAN`), then ranks them with Fuse.js against the query. Matching
 * on the first-name token plus the full name lets a first-name typo ("mile")
 * rank its target ("Mike") highest. Returns owner clients in Fuse score order,
 * deduped, excluding ids already found by the index (`existing`).
 */
async function scanFuzzyMatches(
  ctx: QueryCtx,
  orgId: string,
  query: string,
  includeArchived: boolean,
  existing: Set<Id<"clients">>,
): Promise<Doc<"clients">[]> {
  const candidates: FuzzyCandidate[] = [];
  const clientById = new Map<Id<"clients">, Doc<"clients">>();

  let scannedClients = 0;
  for await (const row of ctx.db
    .query("clients")
    .withIndex("by_org", (index) => index.eq("orgId", orgId))) {
    if (scannedClients >= MAX_FUZZY_SCAN) break;
    scannedClients += 1;
    if (!includeArchived && row.deletedAt !== undefined) continue;
    if (existing.has(row._id)) continue;
    clientById.set(row._id, row);
    candidates.push({
      clientId: row._id,
      name: row.fullName,
      first: firstToken(row.fullName),
    });
  }

  let scannedPets = 0;
  for await (const pet of ctx.db
    .query("pets")
    .withIndex("by_org", (index) => index.eq("orgId", orgId))) {
    if (scannedPets >= MAX_FUZZY_SCAN) break;
    scannedPets += 1;
    if (!includeArchived && pet.deletedAt !== undefined) continue;
    if (existing.has(pet.clientId)) continue;
    candidates.push({
      clientId: pet.clientId,
      name: pet.name,
      first: firstToken(pet.name),
    });
  }

  if (candidates.length === 0) return [];

  const fuse = new Fuse(candidates, {
    keys: ["first", "name"],
    threshold: FUZZY_THRESHOLD,
    ignoreLocation: true,
    ignoreDiacritics: true,
    minMatchCharLength: 2,
  });

  const matches: Doc<"clients">[] = [];
  const seen = new Set<Id<"clients">>();
  for (const { item } of fuse.search(query)) {
    if (seen.has(item.clientId)) continue;
    seen.add(item.clientId);
    // Client candidate → already have the doc; pet candidate → resolve owner.
    let client = clientById.get(item.clientId);
    if (!client) {
      const owner = await ctx.db.get(item.clientId);
      if (!owner || owner.orgId !== orgId) continue;
      if (!includeArchived && owner.deletedAt !== undefined) continue;
      client = owner;
    }
    matches.push(client);
    if (matches.length >= MAX_RESULTS) break;
  }
  return matches;
}

/** Enrich a client with its visible pets + most-recent appointment summary. */
async function enrichClientRow(ctx: QueryCtx, client: Doc<"clients">) {
  const pets = await ctx.db
    .query("pets")
    .withIndex("by_client", (index) => index.eq("clientId", client._id))
    .take(20);
  const visiblePets = pets.filter((pet) => pet.deletedAt === undefined);

  // Most recent appointment for the client. `by_client` isn't ordered by time,
  // so we cap a recent window and pick the latest in JS — keeps the scan bounded.
  const recentAppointments = await ctx.db
    .query("appointments")
    .withIndex("by_client", (index) => index.eq("clientId", client._id))
    .take(50);
  const lastAppointment =
    recentAppointments.sort((a, b) => b.startTime - a.startTime).find(() => true) ??
    null;

  return {
    client,
    pets: visiblePets,
    lastAppointment: lastAppointment
      ? { startTime: lastAppointment.startTime, status: lastAppointment.status }
      : null,
  };
}

/**
 * Lists or searches clients in the caller's org.
 * - `staff+` can read.
 * - When `search` is a digit-only string (e.g. "5550100" or "4231"), the route
 *   streams the org's clients and matches a phone by PREFIX (area code) or
 *   SUFFIX (last-N digits) — not an anywhere-substring — so callers find a
 *   client by area code or the last few digits without boundary-straddle noise.
 * - When `search` contains letters, matches the client's `fullName` OR any of
 *   their pets' names (both via `search_name` fuzzy indexes).
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
      // Text results stay in relevance order (index rank, then fuzzy score).
      return await searchClientsByText(
        ctx,
        orgId,
        search,
        args.includeArchived ?? false,
      );
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
        // Text results stay in relevance order (index rank, then fuzzy score).
        clients = await searchClientsByText(
          ctx,
          orgId,
          search,
          args.includeArchived ?? false,
        );
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
      clients.map((client) => enrichClientRow(ctx, client)),
    );
  },
});

/**
 * Cursor-paginated browse over ALL clients in the org (no search), in creation
 * order (oldest first — same as the old bounded list). Powers the clients
 * board's "load the next batch as you page through" behavior so the list isn't
 * capped at the first 200. Search stays on `listWithPets` (bounded match set).
 * Archived hidden unless `includeArchived`.
 */
export const pageWithPets = query({
  args: {
    paginationOpts: paginationOptsValidator,
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("clients")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .paginate(args.paginationOpts);
    const visible = args.includeArchived
      ? result.page
      : result.page.filter((client) => client.deletedAt === undefined);
    const rows = await Promise.all(
      visible.map((client) => enrichClientRow(ctx, client)),
    );
    return { ...result, page: rows };
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
  phoneLabel: v.optional(phoneLabelValidator),
  altPhones: v.optional(v.array(altPhoneEntryValidator)),
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
  phoneLabel?: PhoneLabel;
  altPhones?: StoredPhoneEntry[];
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}) {
  const normalizedPhone = toE164(args.phone);
  const phone = normalizedPhone || undefined;
  // A label only makes sense when there's a primary number to type.
  const phoneLabel = phone ? args.phoneLabel?.trim() || undefined : undefined;
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
  // Alt phones: number normalized (7-digit → +613, 11-digit/leading-1 →
  // strip), de-duped by number (first label wins), primary excluded so we
  // don't double-count it. Stored as `{ number, label? }`. Empty array
  // collapses to undefined for cleaner reads.
  const byNumber = new Map<string, PhoneLabel | undefined>();
  for (const entry of args.altPhones ?? []) {
    const number = toE164(phoneEntryNumber(entry));
    if (number.length === 0 || number === phone) continue;
    if (!byNumber.has(number)) {
      byNumber.set(number, phoneEntryLabel(entry)?.trim() || undefined);
    }
  }
  const altPhones = Array.from(byNumber, ([number, label]) =>
    label ? { number, label } : { number },
  );
  return {
    fullName,
    firstName,
    lastName,
    phone,
    phoneLabel,
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
 * True when the client's primary phone OR any altPhone STARTS WITH (area code)
 * or ENDS WITH (last-N digits) the caller-supplied digit query. Both are
 * digit-normalized first. Examples: "4231" matches "555-555-4231" (suffix);
 * "613" matches "613-883-1970" (prefix).
 *
 * We deliberately do NOT do an anywhere-substring match: `includes` matches
 * digits that straddle the area-code/prefix boundary (e.g. "1970" sits inside
 * every 519-70x / 819-70x number as "51970…"), flooding results with numbers
 * the user never meant. Prefix-or-suffix reflects how people actually search
 * and matches the future indexed `clientPhones` design.
 */
function phoneMatches(row: Doc<"clients">, digits: string): boolean {
  if (digits.length === 0) return false;
  const stored = [row.phone, ...(row.altPhones ?? []).map(phoneEntryNumber)];
  for (const raw of stored) {
    // Match against both the full E.164 digits and the national number, so a
    // "613…" prefix search still hits a "+1613…" stored number.
    for (const num of phoneSearchDigits(raw)) {
      if (num.length === 0) continue;
      if (num.startsWith(digits) || num.endsWith(digits)) return true;
    }
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

/**
 * One-time migration: convert existing phone numbers to E.164. Legacy rows
 * stored bare NANP digits ("6135551000"); this reparses them as Canadian and
 * rewrites them as "+16135551000" (and the same for every `altPhones` entry,
 * preserving labels). Idempotent — already-E.164 values reparse to themselves,
 * so re-running is safe. Self-schedules the next page until done.
 *
 *   npx convex run clients:backfillPhonesToE164
 */
export const backfillPhonesToE164 = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("clients")
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });
    let updated = 0;
    for (const client of page.page) {
      const patch: Partial<Doc<"clients">> = {};
      if (client.phone) {
        const e164 = toE164(client.phone);
        if (e164 && e164 !== client.phone) patch.phone = e164;
      }
      if (client.altPhones && client.altPhones.length > 0) {
        const next = client.altPhones.map((entry) => {
          const e164 = toE164(phoneEntryNumber(entry));
          return typeof entry === "string" ? e164 : { ...entry, number: e164 };
        });
        if (JSON.stringify(next) !== JSON.stringify(client.altPhones)) {
          patch.altPhones = next;
        }
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(client._id, patch);
        updated += 1;
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.clients.backfillPhonesToE164, {
        cursor: page.continueCursor,
      });
    }
    return { updated, isDone: page.isDone };
  },
});
