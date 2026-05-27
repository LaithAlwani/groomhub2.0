"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export function ReassignDialog({
  appointmentId,
  petName,
  clientName,
  previousStaffName,
  onClose,
}: {
  appointmentId: Id<"appointments">;
  petName: string;
  clientName: string;
  previousStaffName: string;
  onClose: () => void;
}) {
  const staff = useQuery(api.memberships.forOrg, {});
  const reassign = useMutation(api.appointments.reassign);
  useBodyScrollLock();
  const [newStaffId, setNewStaffId] = useState<Id<"memberships"> | "">("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!newStaffId) {
      setServerError("Pick a groomer to reassign to.");
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await reassign({ id: appointmentId, staffId: newStaffId });
      onClose();
    } catch (caught) {
      setServerError(formatAppointmentError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Reassign appointment
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            className="-mt-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {petName} for {clientName} — declined by {previousStaffName}. Pick a
          new groomer and they&apos;ll receive a fresh approval request.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              New groomer
            </span>
            <select
              value={newStaffId}
              onChange={(event) =>
                setNewStaffId(event.target.value as Id<"memberships">)
              }
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="" disabled>
                {staff === undefined ? "Loading…" : "Choose a groomer"}
              </option>
              {staff?.map((row) => (
                <option key={row.membership._id} value={row.membership._id}>
                  {row.user.firstName} {row.user.lastName}
                </option>
              ))}
            </select>
          </label>
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Reassigning…" : "Reassign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
