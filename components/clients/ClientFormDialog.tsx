"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { CountryCode } from "libphonenumber-js";
import { digitsOnly, DEFAULT_PHONE_COUNTRY } from "@/lib/phone";
import { phonesFromClient, phonesToPayload } from "./clientPhones";
import { ClientFormFields } from "./ClientFormFields";
import {
  INITIAL_STATE,
  type ClientFormState,
  type FieldErrors,
} from "./clientFormTypes";

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
  onSuccess,
}: {
  clientId: Id<"clients"> | "new";
  onClose: () => void;
  /** Called with the new client's id after a successful create (not on edit).
   * Lets a caller (e.g. the booking dialog) auto-select the just-created client. */
  onSuccess?: (id: Id<"clients">) => void;
}) {
  const isEdit = clientId !== "new";
  const existing = useQuery(
    api.clients.get,
    isEdit ? { id: clientId } : "skip",
  );

  const create = useMutation(api.clients.create);
  const update = useMutation(api.clients.update);
  const org = useQuery(api.organizations.getCurrent, {});
  const defaultCountry =
    (org?.defaultPhoneCountry as CountryCode | undefined) ??
    DEFAULT_PHONE_COUNTRY;

  const [state, setState] = useState<ClientFormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seededId, setSeededId] = useState<Id<"clients"> | null>(null);
  const [countrySeeded, setCountrySeeded] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  // Seed the form the first time the client resolves — adjusting state during
  // render (React's recommended alternative to a hydration effect).
  if (existing && seededId !== existing._id) {
    setSeededId(existing._id);
    const fallback = splitLegacyName(existing.fullName);
    const next: ClientFormState = {
      firstName: existing.firstName ?? fallback.firstName,
      lastName: existing.lastName ?? fallback.lastName,
      phones: phonesFromClient(existing, defaultCountry),
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
  }

  // New client: once the org's default country resolves, apply it to the
  // still-empty phone rows so the picker starts on the shop's country.
  if (!isEdit && !countrySeeded && org !== undefined) {
    setCountrySeeded(true);
    setState((current) => ({
      ...current,
      phones: current.phones.map((entry) =>
        entry.number ? entry : { ...entry, country: defaultCountry },
      ),
    }));
  }

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
    const hasPhone = state.phones.some(
      (entry) => digitsOnly(entry.number).length > 0,
    );
    if (!hasPhone) {
      next.phones = "Phone number is required";
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
      const payload = {
        firstName: state.firstName.trim() || undefined,
        lastName: state.lastName.trim() || undefined,
        ...phonesToPayload(state.phones),
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
        const newClientId = await create(payload);
        onSuccess?.(newClientId);
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
      title={isEdit ? "Edit client" : "New client"}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 py-5">
          <ClientFormFields
            state={state}
            setField={setField}
            fieldErrors={fieldErrors}
            defaultCountry={defaultCountry}
          />
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
    </DialogShell>
  );
}
