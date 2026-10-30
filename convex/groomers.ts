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
import { softAuth } from "./lib/tenant";

/**
 * Name-only groomers (`groomers` table): people the shop attributes service
 * records to without giving them a login. Admin + superAdmin manage the list
 * on the Staff page; any member can read it for the "Log a service" dropdown.
 *
 * Archive-only by design — there is deliberately no hard delete, so a
 * historical service record always resolves its groomer's name.
 */

const NAME_MAX = 80;
// Upper bound on rows read per org. A shop has a handful of groomers; this is
// only a safety cap so the query stays bounded.
const GROOMERS_MAX = 200;

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const rows = await readOrgGroomers(ctx, identity.orgId);
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => row.deletedAt === undefined);
    return filtered.sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const name = validateName(args.name);
    await assertNameAvailable(ctx, orgId, name, null);
    return await ctx.db.insert("groomers", {
      orgId,
      name,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: { id: v.id("groomers"), name: v.string() },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnGroomer(ctx, args.id, orgId);
    const name = validateName(args.name);
    await assertNameAvailable(ctx, orgId, name, existing._id);
    await ctx.db.patch(existing._id, { name });
    return null;
  },
});

/** Archive (never delete). Idempotent. */
export const archive = mutation({
  args: { id: v.id("groomers") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnGroomer(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return null;
    await ctx.db.patch(existing._id, {
      isActive: false,
      deletedAt: Date.now(),
    });
    return null;
  },
});

/** Undo an archive. Refuses if an active groomer now holds the same name. */
export const restore = mutation({
  args: { id: v.id("groomers") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnGroomer(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return null;
    await assertNameAvailable(ctx, orgId, existing.name, existing._id);
    await ctx.db.patch(existing._id, {
      isActive: true,
      deletedAt: undefined,
    });
    return null;
  },
});

/** Load a groomer the caller's org owns; throws NOT_FOUND / FORBIDDEN. */
export async function loadOwnGroomer(
  ctx: QueryCtx | MutationCtx,
  id: Id<"groomers">,
  orgId: string,
): Promise<Doc<"groomers">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "GROOMER_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

async function readOrgGroomers(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
): Promise<Array<Doc<"groomers">>> {
  return await ctx.db
    .query("groomers")
    .withIndex("by_org", (index) => index.eq("orgId", orgId))
    .take(GROOMERS_MAX);
}

function validateName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (name.length > NAME_MAX) {
    appError("VALIDATION", { field: "name", reason: "LENGTH" });
  }
  return name;
}

/**
 * Case-insensitive uniqueness among ACTIVE groomers in the org, so the
 * dropdown never offers "Sarah" twice. `exceptId` skips the row being renamed
 * or restored.
 */
async function assertNameAvailable(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  name: string,
  exceptId: Id<"groomers"> | null,
): Promise<void> {
  const wanted = name.toLocaleLowerCase();
  const rows = await readOrgGroomers(ctx, orgId);
  const clash = rows.find(
    (row) =>
      row.deletedAt === undefined &&
      row._id !== exceptId &&
      row.name.toLocaleLowerCase() === wanted,
  );
  if (clash) {
    appError("VALIDATION", { field: "name", reason: "DUPLICATE_NAME" });
  }
}
