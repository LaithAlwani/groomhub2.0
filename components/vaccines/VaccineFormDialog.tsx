"use client";
import { formatError } from "@/lib/formatError";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const SPECIES_OPTIONS = ["dog", "cat", "other"] as const;
type Species = (typeof SPECIES_OPTIONS)[number];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  species: z.array(z.enum(SPECIES_OPTIONS)),
  defaultIntervalMonths: z
    .union([
      z.literal(""),
      z.coerce.number().int().positive().max(120),
    ])
    .optional(),
  description: z.string().trim(),
});

type FieldErrors = Partial<Record<keyof typeof schema.shape, string>>;

/**
 * Create / edit dialog for vaccine catalog entries. Species checkboxes use
 * the same `speciesValidator` palette as the services form. An empty species
 * selection means "all species" — the pet form filters the dropdown by the
 * pet's species but always shows entries with no species restriction.
 */
export function VaccineFormDialog({
  vaccineId,
  onClose,
}: {
  vaccineId: Id<"vaccines"> | "new" | null;
  onClose: () => void;
}) {
  const isEdit = vaccineId !== null && vaccineId !== "new";
  const vaccines = useQuery(api.vaccines.list, {});
  const existing = isEdit
    ? vaccines?.find((row) => row._id === vaccineId)
    : undefined;

  const create = useMutation(api.vaccines.create);
  const update = useMutation(api.vaccines.update);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species[]>([]);
  const [defaultIntervalMonths, setDefaultIntervalMonths] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setSpecies(existing.species as Species[]);
    setDefaultIntervalMonths(
      existing.defaultIntervalMonths !== undefined
        ? String(existing.defaultIntervalMonths)
        : "",
    );
    setDescription(existing.description ?? "");
  }, [existing]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  function toggleSpecies(option: Species) {
    setSpecies((current) =>
      current.includes(option)
        ? current.filter((entry) => entry !== option)
        : [...current, option],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({
      name,
      species,
      defaultIntervalMonths: defaultIntervalMonths.trim() || undefined,
      description,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const intervalValue = parsed.data.defaultIntervalMonths;
      const payload = {
        name: parsed.data.name,
        species: parsed.data.species,
        defaultIntervalMonths:
          typeof intervalValue === "number" ? intervalValue : undefined,
        description: parsed.data.description || undefined,
      };
      if (isEdit && vaccineId !== "new" && vaccineId !== null) {
        await update({ id: vaccineId, ...payload });
      } else {
        await create(payload);
      }
      onClose();
    } catch (caught) {
      setServerError(
        formatError(caught, "Could not save"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title={isEdit ? "Edit vaccine" : "New vaccine"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            placeholder="Rabies"
            required
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Species
            </span>
            <div className="flex gap-3">
              {SPECIES_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm capitalize text-zinc-700 dark:text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={species.includes(option)}
                    onChange={() => toggleSpecies(option)}
                    className="h-4 w-4"
                  />
                  {option}
                </label>
              ))}
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Leave all unchecked = applies to every pet.
            </span>
          </div>
          <Field
            label="Default interval (months)"
            type="number"
            inputMode="numeric"
            value={defaultIntervalMonths}
            onChange={setDefaultIntervalMonths}
            error={fieldErrors.defaultIntervalMonths}
            placeholder="12"
          />
          <Field
            label="Description"
            value={description}
            onChange={setDescription}
            error={fieldErrors.description}
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create vaccine"}
            </button>
          </div>
        </form>
    </DialogShell>
  );
}
