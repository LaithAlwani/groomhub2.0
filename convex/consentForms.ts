import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
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
 * Lists active consent-form templates for the caller's org. Sorted by name.
 * Each row carries a resolved `fileUrl` for PDF-import templates so the signing
 * dialog can fetch the source file. Soft-deleted rows hidden unless asked.
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
    const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
    return await Promise.all(
      sorted.map(async (row) => ({
        ...row,
        fileUrl: row.fileStorageId
          ? await ctx.storage.getUrl(row.fileStorageId)
          : null,
      })),
    );
  },
});

const templateInputValidator = {
  name: v.string(),
  // Exactly one of these is provided: `body` (typed text) or `fileStorageId`
  // (an uploaded PDF). Enforced in `validateTemplateInput`.
  body: v.optional(v.string()),
  fileStorageId: v.optional(v.id("_storage")),
};

/**
 * Create a consent-form template (typed text OR uploaded PDF). Admin+ only.
 */
export const createTemplate = mutation({
  args: templateInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    validateTemplateInput(args);
    return await ctx.db.insert("consentTemplates", {
      orgId,
      name: args.name.trim(),
      body: args.fileStorageId ? undefined : args.body?.trim(),
      fileStorageId: args.fileStorageId,
      isActive: true,
    });
  },
});

/**
 * Patch a template's name + source (text or PDF). Admin+ only. Already-signed
 * records keep their snapshot — this only affects NEW signings. Swapping the
 * source deletes the previously-uploaded file.
 */
export const updateTemplate = mutation({
  args: { id: v.id("consentTemplates"), ...templateInputValidator },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnTemplate(ctx, args.id, orgId);
    validateTemplateInput(args);
    if (
      existing.fileStorageId &&
      existing.fileStorageId !== args.fileStorageId
    ) {
      await ctx.storage.delete(existing.fileStorageId);
    }
    await ctx.db.patch(existing._id, {
      name: args.name.trim(),
      body: args.fileStorageId ? undefined : args.body?.trim(),
      fileStorageId: args.fileStorageId,
    });
  },
});

/** Soft-delete a template. superAdmin only. */
export const archiveTemplate = mutation({
  args: { id: v.id("consentTemplates") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnTemplate(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return;
    await ctx.db.patch(existing._id, { isActive: false, deletedAt: Date.now() });
  },
});

/** Undo an archive. superAdmin only. */
export const restoreTemplate = mutation({
  args: { id: v.id("consentTemplates") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnTemplate(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return;
    await ctx.db.patch(existing._id, { isActive: true, deletedAt: undefined });
  },
});

/* ---------------------------------------------------------------------- */
/*                          Signing path                                  */
/* ---------------------------------------------------------------------- */

/** Signed records for a pet, newest first. Powers the pet detail page. */
export const listForPet = query({
  args: { petId: v.id("pets") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.orgId !== identity.orgId) return [];
    const rows = await ctx.db
      .query("signedConsents")
      .withIndex("by_pet", (index) => index.eq("petId", args.petId))
      .collect();
    return await enrichSignedRows(ctx, rows);
  },
});

/** Signed records for an appointment, newest first. Powers the appt page. */
export const listForAppointment = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment || appointment.orgId !== identity.orgId) return [];
    const rows = await ctx.db
      .query("signedConsents")
      .withIndex("by_appointment", (index) =>
        index.eq("appointmentId", args.appointmentId),
      )
      .collect();
    return await enrichSignedRows(ctx, rows);
  },
});

/**
 * Signed records across all of a client's pets, newest first. Read-only
 * roll-up on the client page — signing happens on the pet / appointment.
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
    return await enrichSignedRows(ctx, rows);
  },
});

/** Short-lived upload URL for the signing flow + PDF-template uploads. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Best-effort cleanup of an upload that never made it into a row. */
export const deleteOrphanStorage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    await ctx.storage.delete(args.storageId);
  },
});

/**
 * Records a completed signing event against a pet (and optionally the
 * appointment it was signed from). Derives the client from the pet. Snapshots
 * the template name + body so later edits don't change what was agreed to.
 */
export const recordSigning = mutation({
  args: {
    petId: v.id("pets"),
    appointmentId: v.optional(v.id("appointments")),
    templateId: v.id("consentTemplates"),
    signerName: v.string(),
    signatureStorageId: v.id("_storage"),
    pdfStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const { membership } = await ensureMembership(ctx, identity);

    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "PET_NOT_FOUND" });
    }
    if (pet.deletedAt !== undefined) {
      appError("VALIDATION", { field: "petId", reason: "ARCHIVED" });
    }

    const client = await ctx.db.get(pet.clientId);
    if (!client || client.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    }

    if (args.appointmentId) {
      const appointment = await ctx.db.get(args.appointmentId);
      if (!appointment || appointment.orgId !== identity.orgId) {
        appError("NOT_FOUND", { reason: "APPOINTMENT_NOT_FOUND" });
      }
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "TEMPLATE_NOT_FOUND" });
    }
    if (template.deletedAt !== undefined) {
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
      clientId: pet.clientId,
      petId: pet._id,
      appointmentId: args.appointmentId,
      templateId: template._id,
      templateNameSnapshot: template.name,
      templateBodySnapshot: template.body ?? "",
      signerName: trimmedSignerName,
      signedAt: Date.now(),
      signatureStorageId: args.signatureStorageId,
      pdfStorageId: args.pdfStorageId,
      witnessMembershipId: membership._id,
    });
  },
});

/** Hard-delete a signed record + both files. superAdmin only. */
export const deleteSigned = mutation({
  args: { id: v.id("signedConsents") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await ctx.db.get(args.id);
    if (!existing) appError("NOT_FOUND", { reason: "SIGNED_NOT_FOUND" });
    if (existing.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
    await ctx.storage.delete(existing.signatureStorageId);
    await ctx.storage.delete(existing.pdfStorageId);
    await ctx.db.delete(existing._id);
  },
});

/**
 * One-off backfill: assign `petId` to legacy signed rows that predate the
 * per-pet move. Only fills where the client has exactly one (non-archived)
 * pet — ambiguous cases are left for manual review. Run with
 * `npx convex run consentForms:backfillSignedConsentPets`.
 */
export const backfillSignedConsentPets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("signedConsents").collect();
    let filled = 0;
    let ambiguous = 0;
    for (const row of rows) {
      if (row.petId !== undefined) continue;
      const pets = (
        await ctx.db
          .query("pets")
          .withIndex("by_client", (index) => index.eq("clientId", row.clientId))
          .collect()
      ).filter((pet) => pet.deletedAt === undefined);
      if (pets.length === 1) {
        await ctx.db.patch(row._id, { petId: pets[0]._id });
        filled += 1;
      } else {
        ambiguous += 1;
      }
    }
    return { filled, ambiguous, total: rows.length };
  },
});

async function enrichSignedRows(
  ctx: QueryCtx,
  rows: Doc<"signedConsents">[],
): Promise<
  Array<
    Doc<"signedConsents"> & {
      signatureUrl: string | null;
      pdfUrl: string | null;
      petName: string | null;
    }
  >
> {
  const sorted = rows.sort((a, b) => b.signedAt - a.signedAt);
  return await Promise.all(
    sorted.map(async (row) => {
      const pet = row.petId ? await ctx.db.get(row.petId) : null;
      return {
        ...row,
        signatureUrl: await ctx.storage.getUrl(row.signatureStorageId),
        pdfUrl: await ctx.storage.getUrl(row.pdfStorageId),
        petName: pet?.name ?? null,
      };
    }),
  );
}

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

function validateTemplateInput(args: {
  name: string;
  body?: string;
  fileStorageId?: Id<"_storage">;
}): void {
  const name = args.name.trim();
  if (name.length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (name.length > NAME_MAX) {
    appError("VALIDATION", { field: "name", reason: "LENGTH" });
  }
  const hasBody = (args.body?.trim().length ?? 0) > 0;
  const hasFile = args.fileStorageId !== undefined;
  if (hasBody === hasFile) {
    // Both or neither — exactly one source is required.
    appError("VALIDATION", { field: "body", reason: "SOURCE_REQUIRED" });
  }
  if (hasBody && (args.body?.trim().length ?? 0) > BODY_MAX) {
    appError("VALIDATION", { field: "body", reason: "LENGTH" });
  }
}
