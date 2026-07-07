"use client";

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "noShow"]);

/**
 * Footer for the booking dialog. Bookings are confirmed on creation (no
 * approve/decline flow), so this is just: Cancel appointment (when editing a
 * non-terminal booking), Close/Cancel, and Save/Book.
 */
export function AppointmentDialogFooter({
  isEdit,
  status,
  isDirty,
  submitting,
  cancelling,
  onClose,
  onCancelAppointment,
}: {
  isEdit: boolean;
  status: string | null;
  isDirty: boolean;
  submitting: boolean;
  cancelling: boolean;
  onClose: () => void;
  onCancelAppointment: () => void;
}) {
  const busy = submitting || cancelling;
  const isTerminal = status !== null && TERMINAL_STATUSES.has(status);

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
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Book appointment"}
        </button>
      </div>
    </div>
  );
}
