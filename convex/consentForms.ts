import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { ensureMembership } from "./lib/ensureMembership";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/rbac";
import { requireAuth, softAuth } from "./lib/tenant";

const NAME_MAX = 80;
const BODY_MAX = 20_000;
const SIGNER_NAME_MAX = 120;

/**
 * Lists active consent-form templates for the caller's org. Sorted by name
 * for stable rendering in the catalog page + the signing dropdown. Soft-
 * deleted rows are hidden unless `includeArchived` is true.
 */
export const listTemplates = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const rows = await ctx.db
      .query("consentTemplates")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .collect();
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => row.deletedAt === undefined);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

const templateInputValidator = {
  name: v.string(),
  body: v.string(),
};

/**
 * Create a consent-form template. **Admin + superAdmin only**. Staff see
 * templates as view-only — they can't curate the legal text.
 */
export const createTemplate = mutation({
  args: templateInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    validateTemplateInput(args);
    return await ctx.db.insert("consentTemplates", {
      orgId,
      name: args.name.trim(),
      body: args.body.trim(),
      isActive: true,
    });
  },
});

/**
 * Patch an existing template's name + body. **Admin + superAdmin only**.
 * Already-signed records keep their snapshot — this edit only affects
 * NEW signings.
 */
export const updateTemplate = mutation({
  args: { id: v.id("consentTemplates"), ...templateInputValidator },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnTemplate(ctx, args.id, orgId);
    validateTemplateInput(args);
    await ctx.db.patch(existing._id, {
      name: args.name.trim(),
      body: args.body.trim(),
    });
  },
});

/**
 * Soft-delete a template. **superAdmin only**. Already-signed records
 * still render fine because they use the captured name + body snapshot.
 */
export const archiveTemplate = mutation({
  args: { id: v.id("consentTemplates") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnTemplate(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return;
    await ctx.db.patch(existing._id, {
      isActive: false,
      deletedAt: Date.now(),
    });
  },
});

/**
 * Undo an archive. **superAdmin only**.
 */
export const restoreTemplate = mutation({
  args: { id: v.id("consentTemplates") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnTemplate(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return;
    await ctx.db.patch(existing._id, {
      isActive: true,
      deletedAt: undefined,
    });
  },
});

/* ---------------------------------------------------------------------- */
/*                          Signing path                                  */
/* ---------------------------------------------------------------------- */

/**
 * Lists signed consent records for a client, ordered by signedAt desc.
 * Returns the snapshot fields + resolved `signatureUrl` + `pdfUrl` so the
 * UI can render the list and let the user download the PDF without an
 * extra round-trip.
 */
export const listForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== identity.orgId) return [];
    const rows = await ctx.db
      .query("signedConsents")
      .withIndex("by_client", (index) => index.eq("clientId", args.clientId))
      .collect();
    const sorted = rows.sort((a, b) => b.signedAt - a.signedAt);
    return await Promise.all(
      sorted.map(async (row) => ({
        ...row,
        signatureUrl: await ctx.storage.getUrl(row.signatureStorageId),
        pdfUrl: await ctx.storage.getUrl(row.pdfStorageId),
      })),
    );
  },
});

/**
 * Short-lived upload URL for the signing flow. The client posts the
 * signature PNG and the assembled PDF to it (called twice from
 * `SignConsentDialog`). Auth-gated so we don't hand out free storage.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Best-effort cleanup of an upload that never made it into a `signedConsents`
 * row — e.g. the user closed the dialog mid-signature. Mirrors
 * `pets.deleteOrphanStorage`.
 */
export const deleteOrphanStorage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    await ctx.storage.delete(args.storageId);
  },
});

/**
 * Records a completed signing event: snapshots the template, attaches both
 * storage ids, stamps the witnessing staff + signed-at, and writes the row.
 *
 * Any role can call. The mutation is the moment the consent becomes a legal
 * artifact — once written, only superAdmin can hard-delete via `deleteSigned`.
 */
export const recordSigning = mutation({
  args: {
    clientId: v.id("clients"),
    templateId: v.id("consentTemplates"),
    signerName: v.string(),
    signatureStorageId: v.id("_storage"),
    pdfStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const { membership } = await ensureMembership(ctx, identity);

    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    }
    if (client.deletedAt !== undefined) {
      appError("VALIDATION", { field: "clientId", reason: "ARCHIVED" });
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "TEMPLATE_NOT_FOUND" });
    }
    if (template.deletedAt !== undefined) {
      // Allow signing on a template that's been archived between dialog
      // open and submit? Refuse to be safe — admin shouldn't archive
      // mid-signing.
      appError("VALIDATION", { field: "templateId", reason: "ARCHIVED" });
    }

    const trimmedSignerName = args.signerName.trim();
    if (trimmedSignerName.length === 0) {
      appError("VALIDATION", { field: "signerName", reason: "REQUIRED" });
    }
    if (trimmedSignerName.length > SIGNER_NAME_MAX) {
      appError("VALIDATION", { field: "signerName", reason: "LENGTH" });
    }

    return await ctx.db.insert("signedConsents", {
      orgId: identity.orgId,
      clientId: client._id,
      templateId: template._id,
      templateNameSnapshot: template.name,
      templateBodySnapshot: template.body,
      signerName: trimmedSignerName,
      signedAt: Date.now(),
      signatureStorageId: args.signatureStorageId,
      pdfStorageId: args.pdfStorageId,
      witnessMembershipId: membership._id,
    });
  },
});

/**
 * Hard-delete a signed record + both storage files. superAdmin only —
 * signed consents are legal artifacts; admin can't quietly remove them.
 */
export const deleteSigned = mutation({
  args: { id: v.id("signedConsents") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await ctx.db.get(args.id);
    if (!existing) appError("NOT_FOUND", { reason: "SIGNED_NOT_FOUND" });
    if (existing.orgId !== orgId) {
      appError("FORBIDDEN", { reason: "WRONG_ORG" });
    }
    await ctx.storage.delete(existing.signatureStorageId);
    await ctx.storage.delete(existing.pdfStorageId);
    await ctx.db.delete(existing._id);
  },
});

async function loadOwnTemplate(
  ctx: QueryCtx | MutationCtx,
  id: Id<"consentTemplates">,
  orgId: string,
): Promise<Doc<"consentTemplates">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "TEMPLATE_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

function validateTemplateInput(args: { name: string; body: string }): void {
  const name = args.name.trim();
  if (name.length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (name.length > NAME_MAX) {
    appError("VALIDATION", { field: "name", reason: "LENGTH" });
  }
  const body = args.body.trim();
  if (body.length === 0) {
    appError("VALIDATION", { field: "body", reason: "REQUIRED" });
  }
  if (body.length > BODY_MAX) {
    appError("VALIDATION", { field: "body", reason: "LENGTH" });
  }
}
