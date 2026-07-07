"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ChevronDown } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { CompleteVisitDialog } from "./CompleteVisitDialog";

const STATUS_LABEL: Record<string, string> = {
  pendingApproval: "Pending approval",
  declined: "Declined",
  scheduled: "Scheduled",
  checkedIn: "Checked in",
  inProgress: "In progress",
  completed: "Completed",
  noShow: "No-show",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  pendingApproval:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  checkedIn:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  inProgress:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  noShow: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  cancelled:
    "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

// `pendingApproval` / `declined` are intentionally not selectable: those flow
// through the booking dialog's Confirm / Decline (the assigned groomer's
// prerogative, with their own emails). Everything else is a free transition.
const EDITABLE_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "checkedIn", label: "Checked in" },
  { value: "inProgress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "noShow", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type EditableStatus = (typeof EDITABLE_OPTIONS)[number]["value"];

/**
 * Status badge + change control on the appointment detail page. Replaces the
 * status dropdown that used to live in the edit form. Each change commits
 * immediately via `appointments.updateStatus`, which fires the relevant emails
 * (confirmation, cancellation, pet-ready) server-side.
 */
export function AppointmentStatusControl({
  appointmentId,
  status,
}: {
  appointmentId: Id<"appointments">;
  status: string;
}) {
  const updateStatus = useMutation(api.appointments.updateStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const inMenu = EDITABLE_OPTIONS.some((option) => option.value === status);
  const tone = STATUS_TONE[status] ?? STATUS_TONE.scheduled;

  async function handleChange(next: string) {
    if (next === status) return;
    // Completing a visit isn't a plain status flip — it opens a dialog that
    // captures the service record (service/price/notes/weight/products) and
    // sets `completed` in one step.
    if (next === "completed") {
      setError(null);
      setCompleting(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateStatus({ id: appointmentId, status: next as EditableStatus });
    } catch (caught) {
      setError(formatAppointmentError(caught));
    } finally {
      setBusy(false);
    }
  }

  // pendingApproval / declined aren't free transitions — show a static pill.
  if (!inMenu) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}
      >
        {STATUS_LABEL[status] ?? status}
      </span>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div
        className={`relative inline-flex items-center rounded-full font-semibold shadow-sm ring-1 ring-inset ring-black/5 transition-colors dark:ring-white/10 ${tone} ${
          busy ? "opacity-60" : ""
        }`}
      >
        <select
          value={status}
          disabled={busy}
          onChange={(event) => handleChange(event.target.value)}
          aria-label="Change status"
          className="cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pl-3.5 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:cursor-not-allowed"
        >
          {EDITABLE_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-white font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute right-2.5 opacity-70"
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {completing && (
        <CompleteVisitDialog
          appointmentId={appointmentId}
          onClose={() => setCompleting(false)}
        />
      )}
    </div>
  );
}
