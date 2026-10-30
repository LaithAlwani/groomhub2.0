"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatError } from "@/lib/formatError";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Keep the name under 80 characters"),
});

/**
 * Create / rename dialog for a name-only groomer. Pass the existing doc to
 * rename, `null` to create. Name is the only field — groomers carry no login,
 * schedule or contact details; those belong to invited staff members.
 */
export function GroomerFormDialog({
  groomer,
  onClose,
}: {
  groomer: Doc<"groomers"> | null;
  onClose: () => void;
}) {
  const isEdit = groomer !== null;
  const create = useMutation(api.groomers.create);
  const update = useMutation(api.groomers.update);

  const [name, setName] = useState(groomer?.name ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setSubmitting(true);
    try {
      if (groomer) {
        await update({ id: groomer._id, name: parsed.data.name });
      } else {
        await create({ name: parsed.data.name });
      }
      onClose();
    } catch (caught) {
      setServerError(formatError(caught, "Could not save"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title={isEdit ? "Rename groomer" : "New groomer"}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          error={fieldError}
          placeholder="Sarah"
          required
        />
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add groomer"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}
