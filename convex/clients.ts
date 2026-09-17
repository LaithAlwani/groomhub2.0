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
import { deleteClientPhones, refreshClientPhones } from "./lib/clientPhones";
import {
  refreshClientPetSummary,
  refreshClientSummary,
} from "./lib/clientSummary";
import {
  altPhoneEntryValidator,
  phoneEntryLabel,
  phoneEntryNumber,
  phoneLabelValidator,
  toE164,
  type PhoneLabel,
  type StoredPhoneEntry,
} from "./lib/phone";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";

const MAX_RESULTS = 200;
// How many `clientPhones` index rows to read per prefix/suffix scan. Rows are
// deduped to distinct clients afterward, so we over-read to still surface
// MAX_RESULTS distinct clients when a short query matches many numbers.
const PHONE_INDEX_TAKE = MAX_RESULTS * 4;
// Upper-bound sentinel for a string prefix range: any real digits string sorts
// before `<prefix> + "￿"` and any longer prefix sorts after it.
const HIGH_CODE_POINT = "￿";

// Fuzzy (typo-tolerant) name search. Convex's full-text index requires an exact
// match for short terms, so "mile" won't find "Mike". When the indexed search
// comes back thin we stream the org's clients + pets (bounded, like the phone
// scan) and rank them with Fuse.js. Only runs for thin results, so common
// queries stay index-fast.
const MAX_FUZZY_SCAN = 3_000; // per table (clients, pets) — bounds the read cost
// True last resort: only run fuzzy when the index found NOTHING, so real
// matches are never padded with loosely-similar names.
const FUZZY_TRIGGER = 1; // run fuzzy only when the index returns 0 matches
const FUZZY_MAX_RESULTS = 15; // keep only the closest fuzzy matches (best-first)
const MIN_FUZZY_QUERY_LEN = 4; // ≤3-char queries have plenty of prefix matches
const FUZZY_THRESHOLD = 0.5; // Fuse: lower = stricter, higher = looser

/**
 * Find clients whose primary or alt phone PREFIX-matches (area code) or
 * SUFFIX-matches (last-N digits) `digits`, via the indexed `clientPhones` table
 * — no whole-table scan. Prefix search is a range scan on `digits`; suffix
 * search is a range scan on the reversed digits. Rows are deduped to distinct
 * clients, then loaded to drop cross-org/archived and sort by name.
 */
async function scanPhoneMatches(
  ctx: QueryCtx,
  orgId: string,
  digits: string,
  includeArchived: boolean,
): Promise<Doc<"clients">[]> {
  const reversed = digits.split("").reverse().join("");
  const prefixRows = await ctx.db
    .query("clientPhones")
    .withIndex("by_org_digits", (index) =>
      index
        .eq("orgId", orgId)
        .gte("digits", digits)
        .lt("digits", digits + HIGH_CODE_POINT),
    )
    .take(PHONE_INDEX_TAKE);
  const suffixRows = await ctx.db
    .query("clientPhones")
    .withIndex("by_org_digitsReversed", (index) =>
      index
        .eq("orgId", orgId)
        .gte("digitsReversed", reversed)
        .lt("digitsReversed", reversed + HIGH_CODE_POINT),
    )
    .take(PHONE_INDEX_TAKE);

  const clientIds = new Set<Id<"clients">>();
  for (const row of prefixRows) clientIds.add(row.clientId);
  for (const row of suffixRows) clientIds.add(row.clientId);

  const matches: Doc<"clients">[] = [];
  for (const clientId of clientIds) {
    const client = await ctx.db.get(clientId);
    if (!client || client.orgId !== orgId) continue;
    if (!includeArchived && client.deletedAt !== undefined) continue;
    matches.push(client);
    if (matches.length >= MAX_RESULTS) break;
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
    if (matches.length >= FUZZY_MAX_RESULTS) break;
  }
  return matches;
}

/**
 * Enrich a client for the clients board — projected to ONLY the fields the
 * table/cards/CSV render (name, phone, email, member-since, a few pet
 * names/breeds, last visit).
 *
 * Fast path: read the denormalized `petSummary`/`lastVisit` straight off the
 * client doc the query already loaded — ZERO per-row pet/appointment reads.
 * Fall back to live reads only for docs never touched by the summary backfill
 * (`summaryUpdatedAt === undefined`), so the query stays correct mid-rollout.
 * The summary is kept in sync by the helpers in `lib/clientSummary.ts`.
 */
async function enrichClientRow(ctx: QueryCtx, client: Doc<"clients">) {
  const base = {
    _id: client._id,
    _creationTime: client._creationTime,
    fullName: client.fullName,
    phone: client.phone,
    email: client.email,
  };

  if (client.summaryUpdatedAt !== undefined) {
    return {
      client: base,
      pets: client.petSummary ?? [],
      lastAppointment: client.lastVisit ?? null,
    };
  }

  // Live fallback (pre-backfill doc).
  const pets = await ctx.db
    .query("pets")
    .withIndex("by_client", (index) => index.eq("clientId", client._id))
    .take(8);
  const visiblePets = pets
    .filter((pet) => pet.deletedAt === undefined)
    .map((pet) => ({ _id: pet._id, name: pet.name, breed: pet.breed }));
  const lastAppointment = await ctx.db
    .query("appointments")
    .withIndex("by_client_start", (index) => index.eq("clientId", client._id))
    .order("desc")
    .first();

  return {
    client: base,
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
 * Create a client. Admin + superAdmin only.
 */
export const create = mutation({
  args: clientInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    validateInput(args);
    const clientId = await ctx.db.insert("clients", {
      orgId,
      ...buildClientPatch(args),
    });
    // Put the new (empty) client straight on the denormalized fast path and
    // index its phone numbers for search.
    await refreshClientSummary(ctx, clientId);
    const created = await ctx.db.get(clientId);
    if (created) await refreshClientPhones(ctx, created);
    return clientId;
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
    // Phone/altPhones may have changed — rebuild the search index rows.
    const updated = await ctx.db.get(existing._id);
    if (updated) await refreshClientPhones(ctx, updated);
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
    // Pets were cascade-archived → the denormalized pet summary is now empty.
    await refreshClientPetSummary(ctx, existing._id);
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
    // Drop this client's phone search-index rows before the client is gone.
    await deleteClientPhones(ctx, existing._id);
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

/**
 * One-time migration: populate the denormalized `petSummary`/`petCount`/
 * `lastVisit`/`summaryUpdatedAt` fields for every existing client. Idempotent
 * (pure recompute) — also the re-sync tool after the bulk status migrations.
 * Self-schedules the next page until done.
 *
 *   npx convex run clients:backfillClientSummaries
 */
export const backfillClientSummaries = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("clients")
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });
    for (const client of page.page) {
      await refreshClientSummary(ctx, client._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.clients.backfillClientSummaries,
        { cursor: page.continueCursor },
      );
    }
    return { processed: page.page.length, isDone: page.isDone };
  },
});

/**
 * One-time migration: build the `clientPhones` search-index rows for every
 * existing client. Idempotent (rebuilds each client's rows from scratch).
 * MUST run before phone search returns results. Self-schedules until done.
 *
 *   npx convex run clients:backfillClientPhones
 */
export const backfillClientPhones = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("clients")
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });
    for (const client of page.page) {
      await refreshClientPhones(ctx, client);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.clients.backfillClientPhones, {
        cursor: page.continueCursor,
      });
    }
    return { processed: page.page.length, isDone: page.isDone };
  },
});
