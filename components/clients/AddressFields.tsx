"use client";

import { Field } from "@/components/forms/Field";

export type AddressState = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export function AddressFields({
  state,
  onChange,
}: {
  state: AddressState;
  onChange: <K extends keyof AddressState>(key: K, value: AddressState[K]) => void;
}) {
  return (
    <>
      <Field
        label="Street address (optional)"
        value={state.addressLine1}
        onChange={(value) => onChange("addressLine1", value)}
        placeholder="123 Main Street"
      />
      <Field
        label="Apt / suite / unit (optional)"
        value={state.addressLine2}
        onChange={(value) => onChange("addressLine2", value)}
        placeholder="Apt 4B"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="City (optional)"
          value={state.city}
          onChange={(value) => onChange("city", value)}
        />
        <Field
          label="State / region (optional)"
          value={state.state}
          onChange={(value) => onChange("state", value)}
        />
        <Field
          label="Postal code (optional)"
          value={state.postalCode}
          onChange={(value) => onChange("postalCode", value)}
        />
      </div>
      <Field
        label="Country (optional)"
        value={state.country}
        onChange={(value) => onChange("country", value)}
      />
    </>
  );
}
