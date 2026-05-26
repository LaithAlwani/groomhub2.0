"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type FormState = {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  contactEmail: string;
};

function emptyState(): FormState {
  const browserTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  return {
    name: "",
    slug: "",
    timezone: browserTz,
    currency: "USD",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    contactEmail: "",
  };
}

function stateFromExisting(location: Doc<"locations">): FormState {
  return {
    name: location.name,
    slug: location.slug,
    timezone: location.timezone,
    currency: location.currency,
    addressLine1: location.addressLine1 ?? "",
    city: location.city ?? "",
    state: location.state ?? "",
    postalCode: location.postalCode ?? "",
    country: location.country ?? "",
    phone: location.phone ?? "",
    contactEmail: location.contactEmail ?? "",
  };
}

/**
 * Add / edit dialog for a single location. The Create path is gated by
 * `requirePlanFeature` server-side, so this dialog doesn't bother re-checking
 * the plan — if the user opened it past the gate, they're allowed.
 */
export function LocationFormDialog({
  mode,
  existing,
  onClose,
}: {
  mode: "create" | "edit";
  existing?: Doc<"locations">;
  onClose: () => void;
}) {
  const create = useMutation(api.locations.create);
  const update = useMutation(api.locations.update);
  const [state, setState] = useState<FormState>(() =>
    existing ? stateFromExisting(existing) : emptyState(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await create({
          name: state.name.trim(),
          slug: state.slug.trim().toLowerCase(),
          timezone: state.timezone.trim(),
          currency: state.currency.trim(),
          addressLine1: state.addressLine1 || undefined,
          city: state.city || undefined,
          state: state.state || undefined,
          postalCode: state.postalCode || undefined,
          country: state.country || undefined,
          phone: state.phone || undefined,
          contactEmail: state.contactEmail || undefined,
        });
      } else if (existing) {
        await update({
          id: existing._id,
          name: state.name.trim(),
          slug: state.slug.trim().toLowerCase(),
          timezone: state.timezone.trim(),
          currency: state.currency.trim(),
          addressLine1: state.addressLine1,
          city: state.city,
          state: state.state,
          postalCode: state.postalCode,
          country: state.country,
          phone: state.phone,
          contactEmail: state.contactEmail,
        });
      }
      onClose();
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not save",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-zinc-950 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "create" ? "Add location" : "Edit location"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </header>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
        >
          <Field
            label="Name"
            value={state.name}
            onChange={(value) => setField("name", value)}
            placeholder="Downtown"
          />
          <Field
            label="URL slug"
            value={state.slug}
            onChange={(value) => setField("slug", value)}
            placeholder="downtown"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Timezone"
              value={state.timezone}
              onChange={(value) => setField("timezone", value)}
              placeholder="America/Toronto"
            />
            <Field
              label="Currency"
              value={state.currency}
              onChange={(value) => setField("currency", value)}
              placeholder="USD"
            />
          </div>
          <Field
            label="Street address"
            value={state.addressLine1}
            onChange={(value) => setField("addressLine1", value)}
            placeholder="123 Main St"
          />
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="City"
              value={state.city}
              onChange={(value) => setField("city", value)}
            />
            <Field
              label="State"
              value={state.state}
              onChange={(value) => setField("state", value)}
            />
            <Field
              label="Postal"
              value={state.postalCode}
              onChange={(value) => setField("postalCode", value)}
            />
          </div>
          <Field
            label="Phone"
            type="tel"
            inputMode="tel"
            value={state.phone}
            onChange={(value) => setField("phone", value)}
            placeholder="555-123-4567"
          />
          <Field
            label="Reply-To email (optional)"
            type="email"
            inputMode="email"
            value={state.contactEmail}
            onChange={(value) => setField("contactEmail", value)}
            placeholder="downtown@yourshop.com"
          />
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-auto flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !state.name.trim() || !state.slug.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting
                ? "Saving…"
                : mode === "create"
                  ? "Create location"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
