"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { ReassignDialog } from "./ReassignDialog";

export function DeclinedQueueList() {
  const declined = useQuery(api.appointments.declinedForOrg);
  const updateStatus = useMutation(api.appointments.updateStatus);

  const [busyId, setBusyId] = useState<Id<"appointments"> | null>(null);
  const [reassignTarget, setReassignTarget] = useState<{
    id: Id<"appointments">;
    petName: string;
    clientName: string;
    previousStaffName: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    id: Id<"appointments">;
    petName: string;
    clientName: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (declined === undefined || declined.length === 0) return null;

  async function confirmCancel() {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    setErrorMessage(null);
    try {
      await updateStatus({ id: cancelTarget.id, status: "cancelled" });
      setCancelTarget(null);
    } catch (caught) {
      setErrorMessage(formatAppointmentError(caught));
      setCancelTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
      <header className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-700 dark:text-red-300" />
        <h2 className="text-base font-semibold text-red-900 dark:text-red-200">
          Declined — needs reassignment
        </h2>
      </header>
      <ul className="mt-3 flex flex-col gap-2">
        {declined.map((appointment) => (
          <li
            key={appointment._id}
            className="flex flex-col gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm dark:border-red-900/40 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {appointment.clientName} · {appointment.petName} ·{" "}
                {appointment.serviceName}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {formatDateTime(appointment.startTime)} · declined by{" "}
                {appointment.staffName}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() =>
                  setReassignTarget({
                    id: appointment._id,
                    petName: appointment.petName,
                    clientName: appointment.clientName,
                    previousStaffName: appointment.staffName,
                  })
                }
                disabled={busyId === appointment._id}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <RotateCw size={12} />
                Reassign
              </button>
              <button
                type="button"
                onClick={() =>
                  setCancelTarget({
                    id: appointment._id,
                    petName: appointment.petName,
                    clientName: appointment.clientName,
                  })
                }
                disabled={busyId === appointment._id}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </li>
        ))}
      </ul>
      {errorMessage && (
        <div className="mt-3">
          <ErrorBanner>{errorMessage}</ErrorBanner>
        </div>
      )}
      {reassignTarget && (
        <ReassignDialog
          appointmentId={reassignTarget.id}
          petName={reassignTarget.petName}
          clientName={reassignTarget.clientName}
          previousStaffName={reassignTarget.previousStaffName}
          onClose={() => setReassignTarget(null)}
        />
      )}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this appointment?"
        description={
          cancelTarget && (
            <>
              The client isn&apos;t notified yet — cancelling now is silent
              because the booking never reached them.
            </>
          )
        }
        confirmLabel="Cancel"
        cancelLabel="Keep it"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </section>
  );
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
