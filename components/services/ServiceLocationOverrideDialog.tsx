"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

type Props = {
  service: Doc<"services">;
  location: Doc<"locations">;
  override: Doc<"serviceLocationOverrides"> | null;
  onClose: () => void;
};

/**
 * Edits a single service's override at one location. Empty inputs (or the
 * explicit "Use default" toggle) clear that field so the location falls back
 * to the org-wide value. Hiding the service at the location is its own
 * checkbox (the override's `isActive: false`).
 */
export function ServiceLocationOverrideDialog({
  service,
  location,
  override,
  onClose,
}: Props) {
  const set = useMutation(api.services.setLocationOverride);
  const clear = useMutation(api.services.clearLocationOverride);
  useBodyScrollLock();

  // Empty string = "no override on this field" (fall back to default).
  // Avoid coercing 0 to empty so admin can intentionally set $0 if needed.
  const initialPrice =
    override?.priceCents !== undefined ? (override.priceCents / 100).toString() : "";
  const initialDuration =
    override?.durationMin !== undefined ? override.durationMin.toString() : "";
  const initialActive = override?.isActive ?? true;
  const initialHidden = override?.isActive === false;

  const [price, setPrice] = useState(initialPrice);
  const [duration, setDuration] = useState(initialDuration);
  const [hidden, setHidden] = useState(initialHidden);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !removing) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving, removing]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmedPrice = price.trim();
    const trimmedDuration = duration.trim();
    let priceCents: number | undefined;
    let durationMin: number | undefined;
    if (trimmedPrice !== "") {
      const parsed = Number(trimmedPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Price must be a non-negative number.");
        return;
      }
      priceCents = Math.round(parsed * 100);
    }
    if (trimmedDuration !== "") {
      const parsed = Number(trimmedDuration);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 24 * 60) {
        setError("Duration must be a whole number of minutes (1–1440).");
        return;
      }
      durationMin = parsed;
    }
    const isActive = hidden ? false : undefined;

    setSaving(true);
    try {
      await set({
        serviceId: service._id,
        locationId: location._id,
        priceCents,
        durationMin,
        isActive,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setError(null);
    setRemoving(true);
    try {
      await clear({ serviceId: service._id, locationId: location._id });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not clear");
    } finally {
      setRemoving(false);
    }
  }

  const orgPriceLabel = formatPrice(service.priceCents, service.currency);
  const orgDurationLabel = `${service.durationMin} min`;
  const hasOverride = override !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving && !removing) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-zinc-950 sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Customize for {location.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {service.name} · default {orgDurationLabel} · {orgPriceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </header>
        <form onSubmit={handleSave} className="flex flex-col gap-4 px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Price at {location.name}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={`Default ${orgPriceLabel}`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Leave blank to use the org-wide price.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Duration at {location.name} (minutes)
            </span>
            <input
              type="number"
              inputMode="numeric"
              step="15"
              min="15"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              placeholder={`Default ${service.durationMin} min`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Leave blank to use the org-wide duration.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(event) => setHidden(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Hide this service at {location.name}
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Bookings of this service at this location will be rejected.
              </span>
            </span>
          </label>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="flex items-center justify-between gap-2 pt-1">
            {hasOverride ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving || removing}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {removing ? "Clearing…" : "Reset to default"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || removing}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || removing}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
