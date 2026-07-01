"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Pencil } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Editable appointment total. Defaults to the service base price
 * (`priceCentsSnapshot`); the user can override it, and "Reset to base" clears
 * the override. Stored as `undefined` when equal to the base so it falls back
 * cleanly.
 */
export function AppointmentTotalPrice({
  appointmentId,
  baseCents,
  overrideCents,
  currency,
}: {
  appointmentId: Id<"appointments">;
  baseCents: number;
  overrideCents: number | undefined;
  currency: string;
}) {
  const updateTotalPrice = useMutation(api.appointments.updateTotalPrice);
  const effectiveCents = overrideCents ?? baseCents;
  const isCustom = overrideCents !== undefined && overrideCents !== baseCents;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = (cents: number) => {
    // Guard against a missing/invalid currency on older rows — Intl throws
    // "Currency code is required with currency style" otherwise.
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(cents / 100);
    } catch {
      return `$${(cents / 100).toFixed(2)}`;
    }
  };

  function startEdit() {
    setValue((effectiveCents / 100).toFixed(2));
    setError(null);
    setEditing(true);
  }

  async function save() {
    const parsed = Number(value.trim());
    if (value.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid amount.");
      return;
    }
    const cents = Math.round(parsed * 100);
    setBusy(true);
    setError(null);
    try {
      await updateTotalPrice({
        id: appointmentId,
        // Equal to base ⇒ clear the override so it tracks the base.
        totalPriceCents: cents === baseCents ? undefined : cents,
      });
      setEditing(false);
    } catch (caught) {
      setError(formatError(caught, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function resetToBase() {
    setBusy(true);
    try {
      await updateTotalPrice({ id: appointmentId, totalPriceCents: undefined });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Total price
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={resetToBase}
              disabled={busy}
              className="text-xs font-medium text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
            >
              Reset to base ({format(baseCents)})
            </button>
          )}
        </div>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Total
        </span>
        <p className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {format(effectiveCents)}
          {isCustom && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              custom
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={startEdit}
        aria-label="Edit total price"
        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}
