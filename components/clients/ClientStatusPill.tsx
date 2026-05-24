import type { Doc } from "@/convex/_generated/dataModel";

type AppointmentStatus = Doc<"appointments">["status"];

type PillKind = "completed" | "scheduled" | "pending" | "none";

function kindFor(status: AppointmentStatus | undefined | null): PillKind {
  if (!status) return "none";
  if (status === "completed") return "completed";
  if (status === "pendingApproval" || status === "declined") return "pending";
  if (
    status === "scheduled" ||
    status === "checkedIn" ||
    status === "inProgress"
  ) {
    return "scheduled";
  }
  return "none";
}

const COPY: Record<PillKind, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  scheduled: {
    label: "Scheduled",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300",
  },
  pending: {
    label: "Pending",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-300",
  },
  none: {
    label: "New",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  },
};

export function ClientStatusPill({
  status,
}: {
  status: AppointmentStatus | null | undefined;
}) {
  const { label, className } = COPY[kindFor(status)];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );
}
