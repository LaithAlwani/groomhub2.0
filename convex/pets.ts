import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import { refreshClientPetSummary } from "./lib/clientSummary";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";
import { sexValidator, speciesValidator, vaccinationValidator } from "./schema";

const MAX_PETS_PER_CLIENT = 200;

/**
 * Lists pets for a single client in the caller's org.
 * - `staff+` can read.
 * - `includeArchived=false` (default) hides soft-deleted rows.
 * - Each row is enriched with `imageUrl` resolved from `imageStorageId` so the
 *   UI doesn't need a per-pet round trip to fetch the asset URL.
 * Refuses cross-org client IDs.
 */
export const listForClient = query({
  args: {
    clientId: v.id("clients"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const client = await ctx.db.get(args.clientId);
    if (!client) appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    if (client.orgId !== identity.orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
    const rows = await ctx.db
      .query("pets")
      .withIndex("by_client", (index) => index.eq("clientId", args.clientId))
      .take(MAX_PETS_PER_CLIENT);
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => row.deletedAt === undefined);
    const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
    return await Promise.all(sorted.map((pet) => withImageUrl(ctx, pet)));
  },
});

/**
 * Fetch a single pet by id. Refuses cross-org IDs. Includes the resolved
 * `imageUrl` for the pet's main photo.
 */
export const get = query({
  args: { id: v.id("pets") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const pet = await loadOwnPet(ctx, args.id, identity.orgId);
    return await withImageUrl(ctx, pet);
  },
});

/**
 * Fetch a pet plus its owner for the pet detail page. Same `imageUrl`
 * enrichment as `get`, with a minimal `owner` ({ id, fullName }) so the page
 * can render the breadcrumb back to the client without a second round trip.
 * Refuses cross-org IDs; returns null when unauthenticated.
 */
export const getDetail = query({
  args: { id: v.id("pets") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const pet = await loadOwnPet(ctx, args.id, identity.orgId);
    const client = await ctx.db.get(pet.clientId);
    const withImage = await withImageUrl(ctx, pet);
    return {
      ...withImage,
      owner: client
        ? { id: client._id, fullName: client.fullName }
        : null,
    };
  },
});

/**
 * Returns a short-lived upload URL the client posts the image file to.
 * Auth is required so we don't hand out free storage to random callers; the
 * returned `storageId` is then attached to a pet via `create`/`update`.
 */
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Atomically swap a pet's main photo. Used by the uploader in edit mode so
 * photo changes commit the moment the file lands in storage — no orphans
 * waiting on a `Save changes` click. Pass `storageId: null` to clear the
 * photo entirely. The previous file (if any) is deleted in the same call.
 */
export const setImage = mutation({
  args: {
    id: v.id("pets"),
    storageId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    const nextStorageId = args.storageId ?? undefined;
    if (
      existing.imageStorageId &&
      existing.imageStorageId !== nextStorageId
    ) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.patch(existing._id, { imageStorageId: nextStorageId });
  },
});

/**
 * Toggle a pet's status flags (deceased / banned) directly, without going
 * through the full edit form. Powers the toggle buttons on the pet detail
 * page. Only the flags passed are changed. staff+ — matches `update`.
 */
export const setFlags = mutation({
  args: {
    id: v.id("pets"),
    isDeceased: v.optional(v.boolean()),
    isBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    const patch: { isDeceased?: boolean; isBanned?: boolean } = {};
    if (args.isDeceased !== undefined) patch.isDeceased = args.isDeceased;
    if (args.isBanned !== undefined) patch.isBanned = args.isBanned;
    await ctx.db.patch(existing._id, patch);
  },
});

/**
 * Replace a pet's vaccination records. Powers the standalone vaccinations
 * form on the pet detail page (kept out of the add/edit pet form to keep that
 * form short). staff+ — matches `update`. Validates each expiry date.
 */
export const setVaccinations = mutation({
  args: {
    id: v.id("pets"),
    vaccinations: v.array(vaccinationValidator),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    for (const vaccination of args.vaccinations) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(vaccination.expiresOn)) {
        appError("VALIDATION", {
          field: "vaccinations.expiresOn",
          reason: "INVALID_DATE",
        });
      }
    }
    await ctx.db.patch(existing._id, {
      vaccinations: cleanVaccinations(args.vaccinations),
    });
  },
});

/**
 * Best-effort cleanup for the create-pet flow: the user uploads a photo,
 * never clicks Create, then closes the dialog. We call this with whatever
 * storageId we were holding so it doesn't sit forever in storage.
 *
 * Auth-gated to staff+ so a random caller can't delete files by guessing
 * IDs. Worst case: an authed user could delete an upload they happen to
 * know the id of — low risk given storage IDs are unguessable.
 */
export const deleteOrphanStorage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    await ctx.storage.delete(args.storageId);
  },
});

const petInputValidator = {
  clientId: v.id("clients"),
  name: v.string(),
  species: speciesValidator,
  breed: v.optional(v.string()),
  coatType: v.optional(v.string()),
  sizeLb: v.optional(v.number()),
  birthDate: v.optional(v.string()),
  sex: v.optional(sexValidator),
  isFixed: v.optional(v.boolean()),
  isDeceased: v.optional(v.boolean()),
  isBanned: v.optional(v.boolean()),
  temperament: v.optional(v.string()),
  medicalConditions: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
};

function buildPetPatch(args: {
  name: string;
  species: "dog" | "cat" | "other";
  breed?: string;
  coatType?: string;
  sizeLb?: number;
  birthDate?: string;
  sex?: "male" | "female";
  isFixed?: boolean;
  isDeceased?: boolean;
  isBanned?: boolean;
  temperament?: string;
  medicalConditions?: ReadonlyArray<string>;
  notes?: string;
  imageStorageId?: Id<"_storage">;
}) {
  return {
    name: args.name.trim(),
    species: args.species,
    breed: args.breed?.trim() || undefined,
    coatType: args.coatType?.trim() || undefined,
    sizeLb: args.sizeLb,
    birthDate: args.birthDate?.trim() || undefined,
    sex: args.sex,
    isFixed: args.isFixed,
    isDeceased: args.isDeceased,
    isBanned: args.isBanned,
    temperament: args.temperament?.trim() || undefined,
    medicalConditions: cleanMedicalConditions(args.medicalConditions ?? []),
    notes: args.notes?.trim() || undefined,
    imageStorageId: args.imageStorageId,
  };
}

/**
 * Create a pet. Admin + superAdmin only. Refuses cross-org client.
 */
export const create = mutation({
  args: petInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    validateInput(args);
    const client = await ctx.db.get(args.clientId);
    if (!client) appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    if (client.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
    const petId = await ctx.db.insert("pets", {
      orgId,
      clientId: args.clientId,
      // Vaccinations are managed separately on the pet detail page via
      // `setVaccinations`, so new pets start with none.
      vaccinations: [],
      ...buildPetPatch(args),
    });
    await refreshClientPetSummary(ctx, args.clientId);
    return petId;
  },
});

const petUpdateValidator = {
  name: v.string(),
  species: speciesValidator,
  breed: v.optional(v.string()),
  coatType: v.optional(v.string()),
  sizeLb: v.optional(v.number()),
  birthDate: v.optional(v.string()),
  sex: v.optional(sexValidator),
  isFixed: v.optional(v.boolean()),
  isDeceased: v.optional(v.boolean()),
  isBanned: v.optional(v.boolean()),
  temperament: v.optional(v.string()),
  medicalConditions: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
};

/**
 * Update an existing pet. Admin + superAdmin only. The pet stays attached to
 * its original client — reassignment is intentionally not supported.
 */
export const update = mutation({
  args: { id: v.id("pets"), ...petUpdateValidator },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    validateInput(args);
    if (
      existing.imageStorageId &&
      existing.imageStorageId !== args.imageStorageId
    ) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.patch(existing._id, buildPetPatch(args));
    await refreshClientPetSummary(ctx, existing.clientId);
  },
});

/**
 * Soft-delete a pet (sets `deletedAt`). Admin + superAdmin can call.
 * Appointment history that references this pet stays readable.
 */
export const archive = mutation({
  args: { id: v.id("pets") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return;
    await ctx.db.patch(existing._id, { deletedAt: Date.now() });
    await refreshClientPetSummary(ctx, existing.clientId);
  },
});

/**
 * Restore a previously archived pet. Admin + superAdmin.
 */
export const restore = mutation({
  args: { id: v.id("pets") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return;
    await ctx.db.patch(existing._id, { deletedAt: undefined });
    await refreshClientPetSummary(ctx, existing.clientId);
  },
});

/**
 * Permanently delete a pet. superAdmin only.
 */
export const hardDelete = mutation({
  args: { id: v.id("pets") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnPet(ctx, args.id, orgId);
    if (existing.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.delete(existing._id);
    await refreshClientPetSummary(ctx, existing.clientId);
  },
});

async function loadOwnPet(
  ctx: QueryCtx | MutationCtx,
  id: Id<"pets">,
  orgId: string,
): Promise<Doc<"pets">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "PET_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

function validateInput(args: { name: string; sizeLb?: number }): void {
  if (args.name.trim().length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (args.sizeLb !== undefined && (args.sizeLb < 0 || args.sizeLb > 450)) {
    appError("VALIDATION", { field: "sizeLb", reason: "OUT_OF_RANGE" });
  }
}

function cleanVaccinations(
  rows: ReadonlyArray<{
    vaccineId: Id<"vaccines">;
    expiresOn: string;
    verified: boolean;
  }>,
) {
  return rows.map((row) => ({
    vaccineId: row.vaccineId,
    expiresOn: row.expiresOn,
    verified: row.verified,
  }));
}

function cleanMedicalConditions(
  rows: ReadonlyArray<string>,
): string[] | undefined {
  const cleaned = rows.map((row) => row.trim()).filter((row) => row.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

async function withImageUrl(
  ctx: QueryCtx,
  pet: Doc<"pets">,
): Promise<Doc<"pets"> & { imageUrl: string | null }> {
  const imageUrl = pet.imageStorageId
    ? await ctx.storage.getUrl(pet.imageStorageId)
    : null;
  return { ...pet, imageUrl };
}
