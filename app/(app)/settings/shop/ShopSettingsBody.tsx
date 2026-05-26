"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Field } from "@/components/forms/Field";
import { ShopLogoEditor } from "@/components/settings/ShopLogoEditor";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { digitsOnly, formatPhone } from "@/lib/phone";

type FormState = {
  contactEmail: string;
  contactPhone: string;
};

const INITIAL: FormState = { contactEmail: "", contactPhone: "" };

export function ShopSettingsBody() {
  const org = useQuery(api.organizations.getCurrent);
  const updateContact = useMutation(api.organizations.updateContact);

  const [state, setState] = useState<FormState>(INITIAL);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!org) return;
    const next: FormState = {
      contactEmail: org.contactEmail ?? "",
      contactPhone: formatPhone(org.contactPhone),
    };
    setState(next);
    setInitialSnapshot(JSON.stringify(next));
  }, [org]);

  if (org === undefined) return <Skeleton />;
  if (org === null) {
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Loading shop details…
      </p>
    );
  }

  const isDirty =
    initialSnapshot === null || initialSnapshot !== JSON.stringify(state);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: Partial<FormState> = {};
    if (state.contactEmail.trim() && !state.contactEmail.includes("@")) {
      next.contactEmail = "Looks like an invalid email";
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await updateContact({
        contactEmail: state.contactEmail.trim() || undefined,
        contactPhone: digitsOnly(state.contactPhone) || undefined,
      });
      setInitialSnapshot(JSON.stringify(state));
      setSavedAt(Date.now());
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ShopLogoEditor logoUrl={org.logoUrl ?? null} />
      <ReadOnlyField label="Shop name" value={org.name} hint="Change this from the Manage organization menu in the top bar." />
      <Field
        label="Contact email (optional)"
        type="email"
        inputMode="email"
        value={state.contactEmail}
        onChange={(value) => setField("contactEmail", value)}
        error={fieldErrors.contactEmail}
        placeholder="hello@yourshop.com"
      />
      <Field
        label="Contact phone (optional)"
        type="tel"
        inputMode="tel"
        value={state.contactPhone}
        onChange={(value) => setField("contactPhone", value)}
        onBlur={() => setField("contactPhone", formatPhone(state.contactPhone))}
        placeholder="555-123-4567"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReadOnlyField label="Timezone" value={org.timezone} />
        <ReadOnlyField label="Currency" value={org.currency} />
      </div>
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {savedAt && !isDirty ? "Saved" : ""}
        </span>
        <button
          type="submit"
          disabled={submitting || !isDirty}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {value}
      </div>
      {hint && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <span className="h-3.5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <span className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </div>
  );
}
