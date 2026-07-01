"use client";
import { formatError } from "@/lib/formatError";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { Field } from "@/components/forms/Field";
import { OrgDangerZone } from "@/components/settings/OrgDangerZone";
import { OrgIdentitySection } from "@/components/settings/OrgIdentitySection";
import { ShopLogoEditor } from "@/components/settings/ShopLogoEditor";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { digitsOnly, formatPhone } from "@/lib/phone";

type ContactForm = {
  contactEmail: string;
  contactPhone: string;
};

const INITIAL: ContactForm = { contactEmail: "", contactPhone: "" };

/**
 * Organization settings page body. Stacks four sections:
 *   1. Logo (avatar + tap-to-change)
 *   2. Identity — name + slug (admin+, syncs through Clerk webhook)
 *   3. Contact — email + phone (admin+, written directly to Convex)
 *   4. Danger zone — leave (anyone) + delete (superAdmin only)
 *
 * Read-only timezone + currency lines surface near the bottom — those
 * are set during onboarding and changing them would invalidate every
 * existing booking, so we don't expose an editor.
 */
export function ShopSettingsBody() {
  const org = useQuery(api.organizations.getCurrent);
  const updateContact = useMutation(api.organizations.updateContact);
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const canEdit = role === "admin" || role === "superAdmin";

  const [state, setState] = useState<ContactForm>(INITIAL);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<ContactForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!org) return;
    const next: ContactForm = {
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

  function setField<K extends keyof ContactForm>(
    key: K,
    value: ContactForm[K],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleContactSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: Partial<ContactForm> = {};
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
      setServerError(
        formatError(caught, "Could not save"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Form column kept at max-w-3xl so the inputs stay scannable even
    // though the page wrapper now matches the app-wide max-w-7xl.
    <div className="flex max-w-3xl flex-col gap-8">
      <ShopLogoEditor logoUrl={org.logoUrl ?? null} />

      <SectionHeader title="Identity" />
      <OrgIdentitySection
        initialName={org.name}
        initialSlug={org.slug}
        canEdit={canEdit}
      />

      <SectionHeader title="Contact" />
      <form onSubmit={handleContactSubmit} className="flex flex-col gap-4">
        <Field
          label="Contact email"
          type="email"
          inputMode="email"
          value={state.contactEmail}
          onChange={(value) => setField("contactEmail", value)}
          error={fieldErrors.contactEmail}
          placeholder="hello@yourshop.com"
          readOnly={!canEdit}
        />
        <Field
          label="Contact phone"
          type="tel"
          inputMode="tel"
          value={state.contactPhone}
          onChange={(value) => setField("contactPhone", value)}
          onBlur={() => setField("contactPhone", formatPhone(state.contactPhone))}
          placeholder="555-123-4567"
          readOnly={!canEdit}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Timezone" value={org.timezone} />
          <ReadOnlyField label="Currency" value={org.currency} />
        </div>
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        {canEdit && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {savedAt && !isDirty ? "Saved" : ""}
            </span>
            <button
              type="submit"
              disabled={submitting || !isDirty}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </form>

      <OrgDangerZone orgName={org.name} />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
      {title}
    </h2>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {value}
      </div>
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
