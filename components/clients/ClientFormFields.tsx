"use client";

import type { CountryCode } from "libphonenumber-js";
import { Field } from "@/components/forms/Field";
import { AddressFields } from "./AddressFields";
import { PhonesField } from "./PhonesField";
import type { ClientFormState, FieldErrors, SetField } from "./clientFormTypes";

/**
 * The field layout for the client form (name, phones, email, address, notes).
 * Split out of `ClientFormDialog` so the dialog keeps only state + submit
 * logic and stays under the component line cap.
 */
export function ClientFormFields({
  state,
  setField,
  fieldErrors,
  defaultCountry,
}: {
  state: ClientFormState;
  setField: SetField;
  fieldErrors: FieldErrors;
  defaultCountry: CountryCode;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="First name"
          value={state.firstName}
          onChange={(value) => setField("firstName", value)}
          error={fieldErrors.firstName}
          placeholder="Jane"
          required
        />
        <Field
          label="Last name"
          value={state.lastName}
          onChange={(value) => setField("lastName", value)}
          error={fieldErrors.lastName}
          placeholder="Doe"
          required
        />
      </div>
      <Field
        label="Email"
        type="email"
        value={state.email}
        onChange={(value) => setField("email", value)}
        error={fieldErrors.email}
        inputMode="email"
        placeholder="jane@example.com"
      />
      <PhonesField
        phones={state.phones}
        onChange={(next) => setField("phones", next)}
        defaultCountry={defaultCountry}
        error={fieldErrors.phones}
        required
      />
      <AddressFields state={state} onChange={setField} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Notes
        </span>
        <textarea
          value={state.notes}
          onChange={(event) => setField("notes", event.target.value)}
          rows={3}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
    </>
  );
}
