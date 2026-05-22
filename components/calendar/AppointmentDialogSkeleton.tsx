"use client";

/**
 * Placeholder body that mirrors the real AppointmentFormFields layout so the
 * dialog doesn't jump when the appointment query resolves. Same number of
 * label + input rows, same grid for Date / Start time, same notes textarea
 * shape, same footer footprint.
 */
export function AppointmentDialogSkeleton({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3" aria-busy aria-live="polite">
      {/* Client / Pet / Service / Staff — four single-column field rows. */}
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
      {/* Date + Start time live on a two-column grid. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SkeletonField />
        <SkeletonField />
      </div>
      {/* Status (edit mode only) — still rendered in the skeleton so the
          height matches whichever variant of the form lands. */}
      <SkeletonField />
      <SkeletonField textarea />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="h-9 w-36 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Close
          </button>
          <span className="h-9 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

function SkeletonField({ textarea = false }: { textarea?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="h-3.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <span
        className={
          textarea
            ? "h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
            : "h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        }
      />
    </div>
  );
}
