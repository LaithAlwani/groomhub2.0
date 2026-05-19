import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/rbac";
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
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const client = await ctx.db.get(args.clientId);
    if (!client) appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    if (client.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
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
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const pet = await loadOwnPet(ctx, args.id, orgId);
    return await withImageUrl(ctx, pet);
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

const petInputValidator = {
  clientId: v.id("clients"),
  name: v.string(),
  species: speciesValidator,
  breed: v.optional(v.string()),
  coatType: v.optional(v.string()),
  sizeKg: v.optional(v.number()),
  birthDate: v.optional(v.string()),
  sex: v.optional(sexValidator),
  isFixed: v.optional(v.boolean()),
  temperament: v.optional(v.string()),
  medicalConditions: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
  vaccinations: v.array(vaccinationValidator),
  imageStorageId: v.optional(v.id("_storage")),
};

function buildPetPatch(args: {
  name: string;
  species: "dog" | "cat" | "other";
  breed?: string;
  coatType?: string;
  sizeKg?: number;
  birthDate?: string;
  sex?: "male" | "female";
  isFixed?: boolean;
  temperament?: string;
  medicalConditions?: ReadonlyArray<string>;
  notes?: string;
  vaccinations: ReadonlyArray<{ type: string; expiresOn: string; verified: boolean }>;
  imageStorageId?: Id<"_storage">;
}) {
  return {
    name: args.name.trim(),
    species: args.species,
    breed: args.breed?.trim() || undefined,
    coatType: args.coatType?.trim() || undefined,
    sizeKg: args.sizeKg,
    birthDate: args.birthDate?.trim() || undefined,
    sex: args.sex,
    isFixed: args.isFixed,
    temperament: args.temperament?.trim() || undefined,
    medicalConditions: cleanMedicalConditions(args.medicalConditions ?? []),
    notes: args.notes?.trim() || undefined,
    vaccinations: cleanVaccinations(args.vaccinations),
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
    return await ctx.db.insert("pets", {
      orgId,
      clientId: args.clientId,
      ...buildPetPatch(args),
    });
  },
});

const petUpdateValidator = {
  name: v.string(),
  species: speciesValidator,
  breed: v.optional(v.string()),
  coatType: v.optional(v.string()),
  sizeKg: v.optional(v.number()),
  birthDate: v.optional(v.string()),
  sex: v.optional(sexValidator),
  isFixed: v.optional(v.boolean()),
  temperament: v.optional(v.string()),
  medicalConditions: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
  vaccinations: v.array(vaccinationValidator),
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

function validateInput(args: {
  name: string;
  sizeKg?: number;
  vaccinations: ReadonlyArray<{ type: string; expiresOn: string }>;
}): void {
  if (args.name.trim().length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (args.sizeKg !== undefined && (args.sizeKg < 0 || args.sizeKg > 200)) {
    appError("VALIDATION", { field: "sizeKg", reason: "OUT_OF_RANGE" });
  }
  for (const vaccination of args.vaccinations) {
    if (vaccination.type.trim().length === 0) {
      appError("VALIDATION", { field: "vaccinations.type", reason: "REQUIRED" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vaccination.expiresOn)) {
      appError("VALIDATION", {
        field: "vaccinations.expiresOn",
        reason: "INVALID_DATE",
      });
    }
  }
}

function cleanVaccinations(
  rows: ReadonlyArray<{ type: string; expiresOn: string; verified: boolean }>,
) {
  return rows.map((row) => ({
    type: row.type.trim(),
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
