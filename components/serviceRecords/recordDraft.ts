import type { Id } from "@/convex/_generated/dataModel";
import type { ServiceRecordItem } from "./types";

/** Editable form state for one service record (the edit dialog). */
export type RecordDraft = {
  serviceId: Id<"services"> | null;
  groomerId: Id<"groomers"> | null;
  price: string;
  notes: string;
  weight: string;
  products: string;
};

export function recordToDraft(record: ServiceRecordItem): RecordDraft {
  return {
    serviceId: record.serviceId ?? null,
    groomerId: record.groomerId ?? null,
    price: record.priceCentsSnapshot
      ? (record.priceCentsSnapshot / 100).toFixed(2)
      : "",
    notes: record.notes ?? "",
    weight: record.weightLb ? String(record.weightLb) : "",
    products: (record.productsUsed ?? []).join(", "),
  };
}

/**
 * Turn a draft into `serviceRecords.update` args. Throws with a user-facing
 * message on an invalid price so the row can surface it. `groomerId: null`
 * is sent deliberately — it tells the backend to clear the groomer.
 */
export function draftToUpdate(draft: RecordDraft) {
  const priceTrimmed = draft.price.trim();
  let priceCents = 0;
  if (priceTrimmed !== "") {
    const parsed = Number(priceTrimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("Enter a valid price.");
    }
    priceCents = Math.round(parsed * 100);
  }
  const weightNum = Number(draft.weight.trim());
  return {
    serviceId: draft.serviceId ?? undefined,
    groomerId: draft.groomerId,
    priceCents,
    notes: draft.notes || undefined,
    weightLb:
      draft.weight.trim() !== "" && Number.isFinite(weightNum)
        ? weightNum
        : undefined,
    productsUsed: draft.products
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}
