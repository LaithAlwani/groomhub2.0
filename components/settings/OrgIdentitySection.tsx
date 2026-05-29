"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

/**
 * Edit org name + slug. Updates go through Clerk's `organization.update`
 * API; the `organization.updated` webhook syncs the new values back into
 * the Convex `organizations` row. We pre-validate the slug client-side
 * via `api.organizations.isSlugAvailable` so the user gets fast feedback
 * before the Clerk round-trip.
 *
 * Admin / superAdmin only — gated by the `canEdit` prop the parent
 * derives from the Clerk org role.
 */
export function OrgIdentitySection({
  initialName,
  initialSlug,
  canEdit,
}: {
  initialName: string;
  initialSlug: string;
  canEdit: boolean;
}) {
  const { organization } = useOrganization();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    slug?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Re-sync local state when the props refresh (the webhook just wrote
  // the new values and Convex re-pushed). Without this, the form would
  // stay on the user's just-submitted values, which is fine — but if a
  // *different* device updates the org, this picks up the change.
  useEffect(() => {
    setName(initialName);
    setSlug(initialSlug);
  }, [initialName, initialSlug]);

  // Live availability check, but only when the slug actually changes
  // away from the persisted value. `"skip"` short-circuits the query
  // until there's something worth checking.
  const normalizedSlug = slug.trim().toLowerCase();
  const slugIsDifferent = normalizedSlug !== initialSlug.trim().toLowerCase();
  const slugCheck = useQuery(
    api.organizations.isSlugAvailable,
    slugIsDifferent && normalizedSlug.length > 0
      ? { slug: normalizedSlug }
      : "skip",
  );

  const isDirty =
    name.trim() !== initialName.trim() ||
    normalizedSlug !== initialSlug.trim().toLowerCase();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: { name?: string; slug?: string } = {};
    if (name.trim().length === 0) next.name = "Shop name is required.";
    if (slugIsDifferent && slugCheck && !slugCheck.ok) {
      next.slug =
        slugCheck.code === "SLUG_TAKEN"
          ? "That URL slug is already in use."
          : "Use 3–32 lowercase letters, numbers, or dashes.";
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    if (!organization) return;
    setSubmitting(true);
    try {
      await organization.update({
        name: name.trim(),
        ...(slugIsDifferent ? { slug: normalizedSlug } : {}),
      });
      setSavedAt(Date.now());
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not save",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        label="Shop name"
        value={name}
        onChange={setName}
        error={fieldErrors.name}
        readOnly={!canEdit}
      />
      <div className="flex flex-col gap-1.5">
        <Field
          label="URL slug"
          value={slug}
          onChange={(value) => setSlug(value.toLowerCase())}
          error={fieldErrors.slug}
          readOnly={!canEdit}
          placeholder="your-shop-name"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Appears in your public booking link. Lowercase letters, numbers,
          and dashes only.
        </span>
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
  );
}
