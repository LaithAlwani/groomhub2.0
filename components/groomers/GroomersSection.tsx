"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Scissors } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatError } from "@/lib/formatError";
import { ArchivedGroomersList } from "./ArchivedGroomersList";
import { GroomerFormDialog } from "./GroomerFormDialog";
import { GroomerRow } from "./GroomerRow";

/**
 * "Groomers" card on the Staff page: the admin-managed list of name-only
 * groomers offered in the "Log a service" dropdown. Active rows on top
 * (add / rename / archive), archived rows collapsed underneath with Restore.
 * One subscription (`includeArchived: true`) feeds both halves.
 */
export function GroomersSection() {
  const allGroomers = useQuery(api.groomers.list, { includeArchived: true });
  const archive = useMutation(api.groomers.archive);

  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; groomer: Doc<"groomers"> } | null
  >(null);
  const [confirmTarget, setConfirmTarget] = useState<Doc<"groomers"> | null>(
    null,
  );
  const [busyId, setBusyId] = useState<Id<"groomers"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { active, archived } = useMemo(() => {
    const rows = allGroomers ?? [];
    return {
      active: rows.filter((groomer) => groomer.deletedAt === undefined),
      archived: rows.filter((groomer) => groomer.deletedAt !== undefined),
    };
  }, [allGroomers]);

  async function confirmArchive() {
    if (!confirmTarget) return;
    setBusyId(confirmTarget._id);
    setErrorMessage(null);
    try {
      await archive({ id: confirmTarget._id });
    } catch (caught) {
      setErrorMessage(formatError(caught, "Could not archive"));
    } finally {
      setConfirmTarget(null);
      setBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Groomers
            {allGroomers !== undefined && (
              <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                {active.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Names offered in the &ldquo;Log a service&rdquo; groomer dropdown.
            No login needed &mdash; invite a member above if they need to use
            the app.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ mode: "new" })}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#00273c] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#013a58]"
        >
          <Plus size={14} />
          Add groomer
        </button>
      </header>

      {allGroomers === undefined ? (
        <ListSkeleton />
      ) : active.length === 0 ? (
        <EmptyState />
      ) : (
        <ul>
          {active.map((groomer) => (
            <GroomerRow
              key={groomer._id}
              groomer={groomer}
              busy={busyId === groomer._id}
              onEdit={() => setDialog({ mode: "edit", groomer })}
              onArchive={() => setConfirmTarget(groomer)}
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && <ArchivedGroomersList groomers={archived} />}

      {errorMessage && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      {dialog && (
        <GroomerFormDialog
          groomer={dialog.mode === "edit" ? dialog.groomer : null}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Archive groomer?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.name}&rdquo;
              </span>{" "}
              will no longer appear in the groomer dropdown. Past service
              records keep the name, and you can restore them any time from the
              archived list.
            </>
          )
        }
        confirmLabel="Archive"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmArchive}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <Scissors size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No groomers yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Add the people who groom here &mdash; no login needed.
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
