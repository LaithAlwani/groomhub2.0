import type { Id } from "@/convex/_generated/dataModel";
import { combineLocalIso, isoTimeFromDate } from "@/lib/time";
import type { LogVisitFormState } from "./LogVisitFields";

/**
 * Turn the "Log a service" form state into `serviceRecords.create` args.
 * Pure: throws an `Error` with user-facing copy on a bad price so the dialog
 * can show it. Requires `state.petId` to be set (the dialog validates that
 * first so it can point the error at the pet picker).
 */
export function buildServiceRecordPayload({
  state,
  petId,
  locationId,
  beforeIds,
  afterIds,
}: {
  state: LogVisitFormState;
  petId: Id<"pets">;
  locationId: Id<"locations"> | undefined;
  beforeIds: ReadonlyArray<Id<"_storage">>;
  afterIds: ReadonlyArray<Id<"_storage">>;
}) {
  let priceCents: number | undefined;
  const priceTrimmed = state.price.trim();
  if (priceTrimmed !== "") {
    const parsed = Number(priceTrimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("Enter a valid price.");
    }
    priceCents = Math.round(parsed * 100);
  }
  const weightRaw = (state.weight ?? "").trim();
  const weightNum = Number(weightRaw);
  // Combine the chosen day with the current time so same-day logs keep a
  // sensible order; backend defaults to now if we send nothing.
  const date = state.date
    ? combineLocalIso(state.date, isoTimeFromDate(new Date()))
    : undefined;
  return {
    petId,
    locationId,
    serviceId: state.serviceId ?? undefined,
    groomerId: state.groomerId ?? undefined,
    priceCents,
    notes: state.notes || undefined,
    date,
    weightLb:
      weightRaw !== "" && Number.isFinite(weightNum) ? weightNum : undefined,
    productsUsed: (state.products ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    beforeImageStorageIds: beforeIds.length ? [...beforeIds] : undefined,
    afterImageStorageIds: afterIds.length ? [...afterIds] : undefined,
  };
}
