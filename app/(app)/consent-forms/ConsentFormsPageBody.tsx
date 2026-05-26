"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileSignature, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConsentTemplateFormDialog } from "@/components/consent/ConsentTemplateFormDialog";
import { ConsentTemplateRow } from "@/components/consent/ConsentTemplateRow";

/**
 * Consent-form templates catalog page body. Big page title + subtitle at
 * top, section header `Templates {count}` + dark `+ Add template` row
 * above the bordered table card. Same shape as `VaccinesPageBody` /
 * `ServicesPageBody`.
 *
 * Staff can view the table but the "+ Add template" / edit / archive
 * affordances are gated on `canEdit` (admin + superAdmin).
 */
export function ConsentFormsPageBody({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}) {
  const templates = useQuery(api.consentForms.listTemplates, {});
  const archive = useMutation(api.consentForms.archiveTemplate);

  const [dialog, setDialog] = useState<
    | { mode: "new" }
    | { mode: "edit"; id: Id<"consentTemplates"> }
    | null
  >(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"consentTemplates">; name: string } | null
  >(null);
  const [busyId, setBusyId] = useState<Id<"consentTemplates"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function confirmArchive() {
    if (!confirmTarget) return;
    const { id } = confirmTarget;
    setBusyId(id);
    setErrorMessage(null);
    try {
      await archive({ id });
      setConfirmTarget(null);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not archive",
      );
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  const editingId = dialog?.mode === "edit" ? dialog.id : null;
  const count = templates?.length ?? 0;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Consent forms
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Create the consent text your shop wants every client to sign. When
        you collect a signature from a client profile, you pick from this
        catalog.
      </p>

      <header className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Templates
          {templates !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog({ mode: "new" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00273c] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#013a58]"
          >
            <Plus size={12} />
            Add template
          </button>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>Name</span>
          <span>Body preview</span>
          <span className="text-right">Actions</span>
        </div>
        {templates === undefined ? (
          <ListSkeleton />
        ) : templates.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {templates.map((template) => (
              <ConsentTemplateRow
                key={template._id}
                template={template}
                canEdit={canEdit}
                canDelete={canDelete}
                busy={busyId === template._id}
                onEdit={() => setDialog({ mode: "edit", id: template._id })}
                onArchive={() =>
                  setConfirmTarget({ id: template._id, name: template.name })
                }
              />
            ))}
          </ul>
        )}
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      {dialog && (
        <ConsentTemplateFormDialog
          templateId={dialog.mode === "edit" ? editingId : "new"}
          // Edit mode is view-only for anyone below superAdmin so staff +
          // admin can still read the full text without changing it. New
          // mode is never read-only — any role can create.
          readOnly={dialog.mode === "edit" && !canEdit}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Archive template?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.name}&rdquo;
              </span>{" "}
              won&apos;t show up in the signing dropdown anymore. Past signed
              forms keep their original text — this only affects new signings.
            </>
          )
        }
        confirmLabel="Archive"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmArchive}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <FileSignature size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No templates yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Add a Grooming Consent, Photo Release, Medical Authorisation —
          whatever your shop wants clients to sign.
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
