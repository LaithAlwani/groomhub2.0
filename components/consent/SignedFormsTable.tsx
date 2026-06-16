"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Download, FileSignature, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  formatSignedDate,
  signedPdfFileName,
} from "@/lib/consent/signedFormDisplay";

export type SignedFormRow = {
  _id: Id<"signedConsents">;
  templateNameSnapshot: string;
  signedAt: number;
  signerName: string;
  pdfUrl: string | null;
  petName: string | null;
};

/**
 * Shared table of signed consent forms — reused on the pet, client, and
 * appointment surfaces. Owns the download + (superAdmin-only) delete flow.
 * Pass `showPet` to add a Pet column (used on the client roll-up).
 */
export function SignedFormsTable({
  rows,
  canDelete,
  showPet = false,
}: {
  rows: SignedFormRow[] | undefined;
  canDelete: boolean;
  showPet?: boolean;
}) {
  const deleteSigned = useMutation(api.consentForms.deleteSigned);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: Id<"signedConsents">;
    templateName: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<Id<"signedConsents"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const columns = showPet
    ? "grid-cols-[1.4fr_1fr_0.9fr_1fr_auto]"
    : "grid-cols-[1.5fr_1fr_1.2fr_auto]";

  async function confirmDelete() {
    if (!confirmTarget) return;
    setBusyId(confirmTarget.id);
    setErrorMessage(null);
    try {
      await deleteSigned({ id: confirmTarget.id });
      setConfirmTarget(null);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not delete",
      );
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div
          className={`grid ${columns} items-center gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800`}
        >
          <span>Template</span>
          {showPet && <span>Pet</span>}
          <span>Signed on</span>
          <span>Signer</span>
          <span className="text-right">Actions</span>
        </div>
        {rows === undefined ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row._id}
                className={`grid ${columns} items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900`}
              >
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {row.templateNameSnapshot}
                </p>
                {showPet && (
                  <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {row.petName ?? "—"}
                  </p>
                )}
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {formatSignedDate(row.signedAt)}
                </p>
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {row.signerName}
                </p>
                <div className="flex shrink-0 items-center justify-end gap-1">
                  {row.pdfUrl && (
                    <a
                      href={row.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={signedPdfFileName(
                        row.templateNameSnapshot,
                        row.signerName,
                      )}
                      aria-label="Download signed PDF"
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={busyId === row._id}
                      onClick={() =>
                        setConfirmTarget({
                          id: row._id,
                          templateName: row.templateNameSnapshot,
                        })
                      }
                      aria-label="Delete signed form"
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete signed form?"
        description={
          confirmTarget && (
            <>
              The signed{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.templateName}&rdquo;
              </span>{" "}
              record will be permanently removed, along with its PDF and
              signature image. This is irreversible.
            </>
          )
        }
        confirmLabel="Delete"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <FileSignature size={18} />
      </span>
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        No signed forms yet.
      </p>
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
