import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { normalizePhone } from "./lib/phone";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";
import { speciesValidator, sexValidator } from "./schema";

/**
 * Convex backend for the data importer at `/settings/import`. The client
 * parses a JSON / CSV file that already matches the import schema (see
 * `lib/import/parseImport.ts`); by the time it hits these functions every
 * row is already typed.
 *
 * Two entry points:
 *   - `commitBatch`     — admin-only batched insert (≤50 rows per call) for
 *     clients + their pets + their legacy appointment history.
 *   - `legacyAppointmentsForClient` — read for the client detail page.
 */

const phoneDigits = (raw: string | undefined): string => normalizePhone(raw);

const importClientValidator = v.object({
  fullName: v.string(),
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
});

const importPetValidator = v.object({
  name: v.string(),
  species: speciesValidator,
  breed: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  sex: v.optional(sexValidator),
  sizeLb: v.optional(v.number()),
  notes: v.optional(v.string()),
});

const importLegacyValidator = v.object({
  petName: v.optional(v.string()),
  serviceName: v.optional(v.string()),
  staffName: v.optional(v.string()),
  dateLabel: v.optional(v.string()),
  timeLabel: v.optional(v.string()),
  priceLabel: v.optional(v.string()),
  notes: v.optional(v.string()),
});

/**
 * Each row in a batch:
 *   - `client` may be a brand-new client (insert) OR an existing one we
 *     should attach pets / legacy history to (referenced by id).
 *   - `pets` is appended to the client.
 *   - `legacy` is appended to the legacyAppointments table.
 * Every field is optional so a single row can describe "client only",
 * "client + pets", or "history pointed at an existing client".
 */
const importRowValidator = v.object({
  // Caller-generated unique row id — echoed back in the result so the UI
  // can mark the matching preview row as inserted / failed.
  rowId: v.string(),
  client: v.optional(
    v.union(
      v.object({ kind: v.literal("insert"), data: importClientValidator }),
      v.object({ kind: v.literal("existing"), id: v.id("clients") }),
    ),
  ),
  pets: v.optional(v.array(importPetValidator)),
  legacy: v.optional(v.array(importLegacyValidator)),
});

/**
 * Commits one chunk (≤50 rows) of the import. The wizard calls this in a
 * loop, advancing a progress bar per batch. Each row either lands cleanly
 * (counted in `created`) or fails (collected in `failures` with a reason)
 * — the batch as a whole does NOT abort on a single bad row, so partial
 * imports complete and the user can see exactly what couldn't be saved.
 *
 * Admin / superAdmin only.
 */
export const commitBatch = mutation({
  args: {
    batchId: v.string(),
    sourceSystem: v.optional(v.string()),
    rows: v.array(importRowValidator),
  },
  handler: async (ctx, args) => {
    // Every insert is stamped with the caller's ACTIVE org from the JWT — the
    // `orgId` (and `_id` / `clientId` / `petId`) baked into the source file are
    // deliberately ignored so an import always lands in the current shop.
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    let createdClients = 0;
    let createdPets = 0;
    let createdLegacy = 0;
    const failures: Array<{ rowId: string; reason: string }> = [];
    const importedAt = Date.now();

    for (const row of args.rows) {
      try {
        let clientId: Id<"clients"> | null = null;
        if (row.client) {
          if (row.client.kind === "existing") {
            const existing = await ctx.db.get(row.client.id);
            if (!existing || existing.orgId !== orgId) {
              throw new Error("Existing client not found in this org.");
            }
            clientId = existing._id;
          } else {
            const data = row.client.data;
            const name = data.fullName.trim();
            if (name.length === 0) throw new Error("Missing client name.");
            // De-dupe alt phones against the primary so the same number
            // doesn't appear in both places after import.
            const primaryPhone = phoneDigits(data.phone) || undefined;
            const altDigits = (data.altPhones ?? [])
              .map((value) => phoneDigits(value))
              .filter(
                (value): value is string =>
                  Boolean(value) && value !== primaryPhone,
              );
            const altPhones = Array.from(new Set(altDigits));
            clientId = await ctx.db.insert("clients", {
              orgId,
              fullName: name,
              firstName: data.firstName?.trim() || undefined,
              lastName: data.lastName?.trim() || undefined,
              phone: primaryPhone,
              altPhones: altPhones.length > 0 ? altPhones : undefined,
              email: data.email?.trim() || undefined,
              addressLine1: data.addressLine1?.trim() || undefined,
              addressLine2: data.addressLine2?.trim() || undefined,
              city: data.city?.trim() || undefined,
              state: data.state?.trim() || undefined,
              postalCode: data.postalCode?.trim() || undefined,
              country: data.country?.trim() || undefined,
              notes: data.notes?.trim() || undefined,
            });
            createdClients += 1;
          }
        }

        if (row.pets && row.pets.length > 0) {
          if (!clientId) {
            throw new Error("Pets row has no client to attach to.");
          }
          for (const pet of row.pets) {
            const petName = pet.name.trim();
            if (petName.length === 0) continue;
            await ctx.db.insert("pets", {
              orgId,
              clientId,
              name: petName,
              species: pet.species,
              breed: pet.breed?.trim() || undefined,
              birthDate: pet.birthDate?.trim() || undefined,
              sex: pet.sex,
              sizeLb: pet.sizeLb,
              notes: pet.notes?.trim() || undefined,
              vaccinations: [],
            });
            createdPets += 1;
          }
        }

        if (row.legacy && row.legacy.length > 0) {
          if (!clientId) {
            throw new Error("Legacy rows have no client to attach to.");
          }
          for (const entry of row.legacy) {
            await ctx.db.insert("legacyAppointments", {
              orgId,
              clientId,
              petName: entry.petName?.trim() || undefined,
              serviceName: entry.serviceName?.trim() || undefined,
              staffName: entry.staffName?.trim() || undefined,
              dateLabel: entry.dateLabel?.trim() || undefined,
              timeLabel: entry.timeLabel?.trim() || undefined,
              priceLabel: entry.priceLabel?.trim() || undefined,
              notes: entry.notes?.trim() || undefined,
              sourceSystem: args.sourceSystem?.trim() || undefined,
              importedAt,
              importBatchId: args.batchId,
            });
            createdLegacy += 1;
          }
        }
      } catch (caught) {
        failures.push({
          rowId: row.rowId,
          reason: caught instanceof Error ? caught.message : "Unknown error",
        });
      }
    }

    return {
      created: {
        clients: createdClients,
        pets: createdPets,
        legacy: createdLegacy,
      },
      failures,
    };
  },
});

/**
 * Reads imported legacy appointments for one client, newest first. Used by
 * the client detail page's "Imported history" section. Any signed-in
 * member of the org can read.
 */
export const legacyAppointmentsForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== identity.orgId) return [];
    const rows = await ctx.db
      .query("legacyAppointments")
      .withIndex("by_client", (index) => index.eq("clientId", args.clientId))
      .collect();
    return rows.sort((a, b) => b.importedAt - a.importedAt);
  },
});

/**
 * Edit a single imported legacy appointment's text fields. Admin / superAdmin
 * only. Empty / whitespace values clear the field (Convex removes optional
 * fields patched to `undefined`).
 */
export const updateLegacyAppointment = mutation({
  args: {
    id: v.id("legacyAppointments"),
    petName: v.optional(v.string()),
    serviceName: v.optional(v.string()),
    staffName: v.optional(v.string()),
    dateLabel: v.optional(v.string()),
    timeLabel: v.optional(v.string()),
    priceLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== orgId) {
      throw new Error("Legacy appointment not found in this org.");
    }
    await ctx.db.patch(args.id, {
      petName: args.petName?.trim() || undefined,
      serviceName: args.serviceName?.trim() || undefined,
      staffName: args.staffName?.trim() || undefined,
      dateLabel: args.dateLabel?.trim() || undefined,
      timeLabel: args.timeLabel?.trim() || undefined,
      priceLabel: args.priceLabel?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
    });
  },
});

/**
 * Permanently delete one imported legacy appointment. Admin / superAdmin only.
 * These are read-only audit rows with no dependents, so a hard delete is safe.
 */
export const deleteLegacyAppointment = mutation({
  args: { id: v.id("legacyAppointments") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== orgId) {
      throw new Error("Legacy appointment not found in this org.");
    }
    await ctx.db.delete(args.id);
  },
});
