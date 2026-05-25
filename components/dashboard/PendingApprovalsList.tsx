"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useConvexCachedQuery } from "@/lib/offline/useConvexCachedQuery";
import { Check, Clock, PhoneCall, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { formatPhone } from "@/lib/phone";

export function PendingApprovalsList() {
  const pending = useConvexCachedQuery(api.appointments.pendingForMe);
  const updateStatus = useMutation(api.appointments.updateStatus);

  const [busyId, setBusyId] = useState<Id<"appointments"> | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    | { id: Id<"appointments">; petName: string; clientName: string }
    | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (pending === undefined) return <Skeleton />;
  if (pending.length === 0) return null;

  async function approve(id: Id<"appointments">) {
    setBusyId(id);
    setErrorMessage(null);
    try {
      await updateStatus({ id, status: "scheduled" });
    } catch (caught) {
      setErrorMessage(formatAppointmentError(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDecline() {
    if (!confirmTarget) return;
    setBusyId(confirmTarget.id);
    setErrorMessage(null);
    try {
      await updateStatus({ id: confirmTarget.id, status: "declined" });
      setConfirmTarget(null);
    } catch (caught) {
      setErrorMessage(formatAppointmentError(caught));
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <header className="flex items-center gap-2">
        <Clock size={16} className="text-amber-700 dark:text-amber-300" />
        <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
          Needs your approval
        </h2>
      </header>
      <ul className="mt-3 flex flex-col gap-2">
        {pending.map((appointment) => (
          <li
            key={appointment._id}
            className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {appointment.clientName} · {appointment.petName} ·{" "}
                {appointment.serviceName}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {formatDateTime(appointment.startTime)} (booked by admin)
              </p>
              {!appointment.clientEmail && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <PhoneCall size={11} aria-hidden />
                  No email — call
                  {appointment.clientPhone
                    ? ` ${formatPhone(appointment.clientPhone)}`
                    : " the client"}{" "}
                  to confirm
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => approve(appointment._id)}
                disabled={busyId === appointment._id}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <Check size={12} />
                Confirm
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfirmTarget({
                    id: appointment._id,
                    petName: appointment.petName,
                    clientName: appointment.clientName,
                  })
                }
                disabled={busyId === appointment._id}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
              >
                <X size={12} />
                Decline
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
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Send back to admin?"
        description={
          confirmTarget && (
            <>
              Declining puts{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {confirmTarget.petName}
              </span>
              &rsquo;s booking for{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {confirmTarget.clientName}
              </span>{" "}
              into the admin&apos;s declined queue. They&rsquo;ll reassign or
              cancel it. The client isn&apos;t notified yet.
            </>
          )
        }
        confirmLabel="Decline"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmDecline}
        onCancel={() => setConfirmTarget(null)}
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

function Skeleton() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <header className="flex items-center gap-2">
        <Clock size={16} className="text-amber-700 dark:text-amber-300" />
        <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
          Needs approval
        </h2>
      </header>
      <div className="mt-3 h-10 animate-pulse rounded-lg bg-amber-100/60 dark:bg-amber-900/30" />
    </section>
  );
}
