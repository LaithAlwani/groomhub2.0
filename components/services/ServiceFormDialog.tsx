"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const SPECIES_OPTIONS = ["dog", "cat", "other"] as const;
type Species = (typeof SPECIES_OPTIONS)[number];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim(),
  durationMin: z.number().int().positive("Must be at least 1 minute").max(24 * 60),
  priceCents: z.number().int().nonnegative("Must be 0 or greater"),
  species: z.array(z.enum(SPECIES_OPTIONS)).min(1, "Pick at least one species"),
  color: z.string().trim(),
});

type FormInput = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormInput, string>>;

export function ServiceFormDialog({
  serviceId,
  onClose,
}: {
  serviceId: Id<"services"> | "new";
  onClose: () => void;
}) {
  const isEdit = serviceId !== "new";
  const services = useQuery(api.services.list, {});
  const existing = isEdit
    ? services?.find((row) => row._id === serviceId)
    : undefined;

  const create = useMutation(api.services.create);
  const update = useMutation(api.services.update);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [priceDollars, setPriceDollars] = useState("0");
  const [species, setSpecies] = useState<Species[]>(["dog"]);
  const [color, setColor] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description ?? "");
    setDurationMin(String(existing.durationMin));
    setPriceDollars((existing.priceCents / 100).toFixed(2));
    setSpecies(existing.species as Species[]);
    setColor(existing.color ?? "");
  }, [existing]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({
      name,
      description,
      durationMin: Number(durationMin),
      priceCents: Math.round(Number(priceDollars) * 100),
      species,
      color,
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
      const payload = {
        name: parsed.data.name,
        description: parsed.data.description || undefined,
        durationMin: parsed.data.durationMin,
        priceCents: parsed.data.priceCents,
        species: parsed.data.species,
        color: parsed.data.color || undefined,
      };
      if (isEdit) {
        await update({ id: serviceId, ...payload });
      } else {
        await create(payload);
      }
      onClose();
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSpecies(option: Species) {
    setSpecies((current) =>
      current.includes(option)
        ? current.filter((entry) => entry !== option)
        : [...current, option],
    );
  }

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {isEdit ? "Edit service" : "New service"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            placeholder="Full groom — small dog"
          />
          <Field
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            error={fieldErrors.description}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Duration (minutes)"
              type="number"
              value={durationMin}
              onChange={setDurationMin}
              error={fieldErrors.durationMin}
              inputMode="numeric"
            />
            <Field
              label="Price"
              type="number"
              value={priceDollars}
              onChange={setPriceDollars}
              error={fieldErrors.priceCents}
              inputMode="decimal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Species
            </span>
            <div className="flex gap-3">
              {SPECIES_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
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
            {fieldErrors.species && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.species}
              </span>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Calendar colour (optional)
            </span>
            <input
              type="color"
              value={color || "#22c55e"}
              onChange={(event) => setColor(event.target.value)}
              className="h-9 w-16 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
            />
          </label>
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
