import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AppointmentStatus } from "./appointmentStatus";

/**
 * Recompute + persist the denormalized clients-board summary
 * (`petSummary`/`petCount`/`lastVisit`) that `enrichClientRow` reads straight
 * off the client doc. Every mutation that changes a client's visible pets or
 * appointments calls the matching refresh helper AFTER its own write, in the
 * SAME transaction, so the summary is never transiently inconsistent.
 *
 * The `clients` schema fields point back here — keep the two in sync.
 */

// Cap the pet list stored on the doc (the board's ClientPetPills shows names).
const PET_SUMMARY_LIMIT = 8;
// Defensive bound on how many pet rows we scan to count visibles — a grooming
// client has a handful; this just stops a pathological row from unbounding.
const PET_SCAN_CAP = 200;

export type PetSummaryEntry = {
  _id: Id<"pets">;
  name: string;
  breed?: string;
};

export type LastVisit = { startTime: number; status: AppointmentStatus };

/**
 * First `PET_SUMMARY_LIMIT` VISIBLE pets (in `by_client` order) plus the true
 * visible count. Unlike the old `enrichClientRow` (which did `.take(8)` on RAW
 * rows THEN filtered), this filters first — so archived pets among the first 8
 * no longer shrink the list.
 */
export async function computePetSummary(
  ctx: MutationCtx,
  clientId: Id<"clients">,
): Promise<{ petSummary: PetSummaryEntry[]; petCount: number }> {
  const petSummary: PetSummaryEntry[] = [];
  let petCount = 0;
  let scanned = 0;
  for await (const pet of ctx.db
    .query("pets")
    .withIndex("by_client", (index) => index.eq("clientId", clientId))) {
    if (scanned >= PET_SCAN_CAP) break;
    scanned += 1;
    if (pet.deletedAt !== undefined) continue;
    petCount += 1;
    if (petSummary.length < PET_SUMMARY_LIMIT) {
      petSummary.push({ _id: pet._id, name: pet.name, breed: pet.breed });
    }
  }
  return { petSummary, petCount };
}

/**
 * Most-recent appointment by `startTime` — NO status filter (cancelled/noShow
 * still count), matching the old live behavior. `undefined` when the client
 * has no appointments.
 */
export async function computeLastVisit(
  ctx: MutationCtx,
  clientId: Id<"clients">,
): Promise<LastVisit | undefined> {
  const last = await ctx.db
    .query("appointments")
    .withIndex("by_client_start", (index) => index.eq("clientId", clientId))
    .order("desc")
    .first();
  return last ? { startTime: last.startTime, status: last.status } : undefined;
}

/** Recompute + patch just the pet fields. Safe no-op if the client is gone. */
export async function refreshClientPetSummary(
  ctx: MutationCtx,
  clientId: Id<"clients">,
): Promise<void> {
  if (!(await ctx.db.get(clientId))) return;
  const { petSummary, petCount } = await computePetSummary(ctx, clientId);
  await ctx.db.patch(clientId, {
    petSummary,
    petCount,
    summaryUpdatedAt: Date.now(),
  });
}

/** Recompute + patch just the last-visit field. Safe no-op if client is gone. */
export async function refreshClientLastVisit(
  ctx: MutationCtx,
  clientId: Id<"clients">,
): Promise<void> {
  if (!(await ctx.db.get(clientId))) return;
  const lastVisit = await computeLastVisit(ctx, clientId);
  // Patching `lastVisit: undefined` clears the field when there are no appts.
  await ctx.db.patch(clientId, { lastVisit, summaryUpdatedAt: Date.now() });
}

/** Recompute + patch the whole summary (cascades + backfill). */
export async function refreshClientSummary(
  ctx: MutationCtx,
  clientId: Id<"clients">,
): Promise<void> {
  if (!(await ctx.db.get(clientId))) return;
  const { petSummary, petCount } = await computePetSummary(ctx, clientId);
  const lastVisit = await computeLastVisit(ctx, clientId);
  await ctx.db.patch(clientId, {
    petSummary,
    petCount,
    lastVisit,
    summaryUpdatedAt: Date.now(),
  });
}
