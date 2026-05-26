"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { Download, FileSignature, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SignConsentDialog } from "@/components/consent/SignConsentDialog";
import { mapClerkOrgRole } from "@/convex/lib/roles";

/**
 * Signed consent forms section on the client detail page. Section title +
 * "+ Sign new form" button sit above the bordered table card with the dark
 * zinc-900 header strip (TEMPLATE / SIGNED ON / SIGNER / ACTIONS). Each row
 * lets any role download the PDF; only superAdmin sees the trash icon
 * (the server gates the mutation the same way).
 */
export function ClientConsentSection({
  clientId,
}: {
  clientId: Id<"clients">;
}) {
  const signed = useQuery(api.consentForms.listForClient, { clientId });
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const canDelete = role === "superAdmin";

  const deleteSigned = useMutation(api.consentForms.deleteSigned);
  const [signOpen, setSignOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"signedConsents">; templateName: string } | null
  >(null);
  const [busyId, setBusyId] = useState<Id<"signedConsents"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const count = signed?.length ?? 0;

  return (
    <section className="mt-8">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Signed forms
          {signed !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setSignOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#00273c] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#013a58]"
        >
          <Plus size={12} />
          Sign new form
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.5fr_1fr_1.2fr_auto] items-center gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>Template</span>
          <span>Signed on</span>
          <span>Signer</span>
          <span className="text-right">Actions</span>
        </div>
        {signed === undefined ? (
          <ListSkeleton />
        ) : signed.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {signed.map((row) => (
              <li
                key={row._id}
                className="grid grid-cols-[1.5fr_1fr_1.2fr_auto] items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900"
              >
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {row.templateNameSnapshot}
                </p>
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {formatDate(row.signedAt)}
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
                      download={pdfFileName(row.templateNameSnapshot, row.signerName)}
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

      {signOpen && (
        <SignConsentDialog
          clientId={clientId}
          onClose={() => setSignOpen(false)}
        />
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
        <FileSignature size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No signed forms yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Tap &ldquo;Sign new form&rdquo; and hand the tablet to the client.
        </p>
      </div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pdfFileName(templateName: string, signerName: string): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "consent";
  return `${slug(templateName)}-${slug(signerName)}.pdf`;
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
