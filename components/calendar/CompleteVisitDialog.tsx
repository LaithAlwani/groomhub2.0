"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatError } from "@/lib/formatError";
import { ServiceSelectField } from "./ServiceSelectField";

/**
 * Marks a scheduled appointment complete by creating a linked service record
 * (the permanent history) and flipping the appointment to `completed`. Prefills
 * service / price / notes from the appointment; the groomer can adjust and add
 * weight / products before finishing.
 */
export function CompleteVisitDialog({
  appointmentId,
  onClose,
}: {
  appointmentId: Id<"appointments">;
  onClose: () => void;
}) {
  const appointment = useQuery(api.appointments.get, { id: appointmentId });
  const complete = useMutation(api.serviceRecords.completeAppointment);

  const [serviceId, setServiceId] = useState<Id<"services"> | null>(null);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [weight, setWeight] = useState("");
  const [products, setProducts] = useState("");
  const [seededId, setSeededId] = useState<Id<"appointments"> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed from the appointment during render (avoids a hydration effect).
  if (appointment && seededId !== appointment._id) {
    setSeededId(appointment._id);
    setServiceId(appointment.serviceId);
    setPrice(
      ((appointment.totalPriceCents ?? appointment.priceCentsSnapshot) / 100).toFixed(2),
    );
    setNotes(appointment.notes ?? "");
  }
  const currency = appointment?.serviceCurrency ?? "USD";
  const inputClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    let priceCents: number | undefined;
    const priceTrimmed = price.trim();
    if (priceTrimmed !== "") {
      const parsed = Number(priceTrimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Enter a valid price.");
        return;
      }
      priceCents = Math.round(parsed * 100);
    }
    const weightNum = Number(weight.trim());
    setSubmitting(true);
    try {
      await complete({
        appointmentId,
        serviceId: serviceId ?? undefined,
        priceCents,
        notes: notes || undefined,
        weightLb:
          weight.trim() !== "" && Number.isFinite(weightNum)
            ? weightNum
            : undefined,
        productsUsed: products
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (caught) {
      setError(formatError(caught, "Could not complete the appointment."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title="Complete visit"
      maxWidth="md"
    >
      <div className="px-5 py-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <ServiceSelectField value={serviceId} onChange={setServiceId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Price ({currency})
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Weight (lb)
              </span>
              <input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="—"
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Products used
            </span>
            <input
              type="text"
              value={products}
              onChange={(event) => setProducts(event.target.value)}
              placeholder="Comma-separated"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !appointment}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : "Complete visit"}
            </button>
          </div>
        </form>
      </div>
    </DialogShell>
  );
}
