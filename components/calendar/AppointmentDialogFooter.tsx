"use client";

import { Check, RotateCw, X } from "lucide-react";

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "noShow"]);

export function AppointmentDialogFooter({
  isEdit,
  status,
  canReassign,
  isDirty,
  submitting,
  cancelling,
  onClose,
  onCancelAppointment,
  onApprove,
  onDecline,
  onReassign,
}: {
  isEdit: boolean;
  status: string | null;
  canReassign: boolean;
  isDirty: boolean;
  submitting: boolean;
  cancelling: boolean;
  onClose: () => void;
  onCancelAppointment: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onReassign: () => void;
}) {
  const busy = submitting || cancelling;
  const isPending = status === "pendingApproval";
  const isDeclined = status === "declined";
  const isTerminal = status !== null && TERMINAL_STATUSES.has(status);

  if (isPending) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
        >
          <X size={14} />
          Decline
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <Check size={14} />
            Confirm appointment
          </button>
        </div>
      </div>
    );
  }

  if (isDeclined && canReassign) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancelAppointment}
          disabled={busy}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60"
        >
          Cancel appointment
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onReassign}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <RotateCw size={14} />
            Reassign
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      {isEdit && !isTerminal ? (
        <button
          type="button"
          onClick={onCancelAppointment}
          disabled={busy}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60"
        >
          Cancel appointment
        </button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {isEdit ? "Close" : "Cancel"}
        </button>
        <button
          type="submit"
          disabled={busy || !isDirty}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Book appointment"}
        </button>
      </div>
    </div>
  );
}
