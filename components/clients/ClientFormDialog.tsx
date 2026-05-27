"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { digitsOnly, formatPhone } from "@/lib/phone";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { AddressFields } from "./AddressFields";
import { PhonesField } from "./PhonesField";

type ClientFormState = {
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof ClientFormState | "fullName", string>>;

const INITIAL_STATE: ClientFormState = {
  firstName: "",
  lastName: "",
  phones: [""],
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  notes: "",
};

/**
 * Split a legacy single-field name on the first space so older clients
 * (only `fullName` is set, no firstName/lastName) load reasonably into the
 * new two-field form. "Mary Jo Smith" becomes first="Mary", last="Jo Smith"
 * — the user can correct if needed.
 */
function splitLegacyName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const spaceAt = trimmed.indexOf(" ");
  if (spaceAt < 0) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, spaceAt),
    lastName: trimmed.slice(spaceAt + 1).trim(),
  };
}

export function ClientFormDialog({
  clientId,
  onClose,
}: {
  clientId: Id<"clients"> | "new";
  onClose: () => void;
}) {
  const isEdit = clientId !== "new";
  const existing = useQuery(
    api.clients.get,
    isEdit ? { id: clientId } : "skip",
  );

  const create = useMutation(api.clients.create);
  const update = useMutation(api.clients.update);
  useBodyScrollLock();

  const [state, setState] = useState<ClientFormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    const fallback = splitLegacyName(existing.fullName);
    const allPhones = [existing.phone, ...(existing.altPhones ?? [])]
      .map((value) => formatPhone(value ?? ""))
      .filter((value) => value.length > 0);
    const next: ClientFormState = {
      firstName: existing.firstName ?? fallback.firstName,
      lastName: existing.lastName ?? fallback.lastName,
      phones: allPhones.length > 0 ? allPhones : [""],
      email: existing.email ?? "",
      addressLine1: existing.addressLine1 ?? "",
      addressLine2: existing.addressLine2 ?? "",
      city: existing.city ?? "",
      state: existing.state ?? "",
      postalCode: existing.postalCode ?? "",
      country: existing.country ?? "",
      notes: existing.notes ?? "",
    };
    setState(next);
    setInitialSnapshot(JSON.stringify(next));
  }, [existing]);

  const isDirty = isEdit
    ? initialSnapshot === null || initialSnapshot !== JSON.stringify(state)
    : true;

  function setField<K extends keyof ClientFormState>(
    key: K,
    value: ClientFormState[K],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: FieldErrors = {};
    if (state.firstName.trim().length === 0 && state.lastName.trim().length === 0) {
      next.firstName = "First or last name is required";
    }
    if (state.email.trim() && !state.email.includes("@"))
      next.email = "Looks like an invalid email";
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      // Split the phones list: first non-empty entry = primary; rest = alts.
      // De-dupe digits-only so the same number can't sit in both positions.
      const phoneDigitsList = state.phones
        .map((value) => digitsOnly(value))
        .filter((value) => value.length > 0);
      const uniquePhones = Array.from(new Set(phoneDigitsList));
      const [primary, ...alts] = uniquePhones;
      const payload = {
        firstName: state.firstName.trim() || undefined,
        lastName: state.lastName.trim() || undefined,
        phone: primary || undefined,
        altPhones: alts.length > 0 ? alts : undefined,
        email: state.email.trim() || undefined,
        addressLine1: state.addressLine1.trim() || undefined,
        addressLine2: state.addressLine2.trim() || undefined,
        city: state.city.trim() || undefined,
        state: state.state.trim() || undefined,
        postalCode: state.postalCode.trim() || undefined,
        country: state.country.trim() || undefined,
        notes: state.notes.trim() || undefined,
      };
      if (isEdit) {
        await update({ id: clientId, ...payload });
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

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? "Edit client" : "New client"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="First name"
              value={state.firstName}
              onChange={(value) => setField("firstName", value)}
              error={fieldErrors.firstName}
              placeholder="Jane"
            />
            <Field
              label="Last name"
              value={state.lastName}
              onChange={(value) => setField("lastName", value)}
              error={fieldErrors.lastName}
              placeholder="Doe"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PhonesField
              phones={state.phones}
              onChange={(next) => setField("phones", next)}
            />
            <Field
              label="Email (optional)"
              type="email"
              value={state.email}
              onChange={(value) => setField("email", value)}
              error={fieldErrors.email}
              inputMode="email"
              placeholder="jane@example.com"
            />
          </div>
          <AddressFields state={state} onChange={setField} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Notes (optional)
            </span>
            <textarea
              value={state.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={3}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
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
              disabled={submitting || !isDirty}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
