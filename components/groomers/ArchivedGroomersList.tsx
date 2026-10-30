"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatError } from "@/lib/formatError";

/**
 * Collapsed "Archived (N)" strip under the active groomers. Archived groomers
 * stay on file forever (old service records still show their name); each row
 * offers a one-click Restore.
 */
export function ArchivedGroomersList({
  groomers,
}: {
  groomers: ReadonlyArray<Doc<"groomers">>;
}) {
  const restore = useMutation(api.groomers.restore);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<Id<"groomers"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRestore(id: Id<"groomers">) {
    setBusyId(id);
    setErrorMessage(null);
    try {
      await restore({ id });
    } catch (caught) {
      setErrorMessage(formatError(caught, "Could not restore"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/60"
      >
        <span>Archived ({groomers.length})</span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="bg-zinc-50/60 dark:bg-zinc-900/30">
          {groomers.map((groomer) => (
            <li
              key={groomer._id}
              className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-2.5 dark:border-zinc-900"
            >
              <p className="truncate text-sm text-zinc-500 line-through decoration-zinc-300 dark:text-zinc-400 dark:decoration-zinc-600">
                {groomer.name}
              </p>
              <button
                type="button"
                onClick={() => handleRestore(groomer._id)}
                disabled={busyId !== null}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-white disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <RotateCcw size={12} aria-hidden />
                {busyId === groomer._id ? "Restoring…" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorMessage && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
