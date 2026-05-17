"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { validateSlugShape } from "@/convex/lib/reservedSlugs";
import { SlugInput } from "./SlugInput";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const formSchema = z.object({
  name: z.string().trim().min(2, "Shop name is required"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Slug must be at least 3 characters")
    .max(40, "Slug must be at most 40 characters")
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, "Letters, numbers and dashes only"),
  timezone: z.string().min(1),
  currency: z.enum(SUPPORTED_CURRENCIES),
});

type FormInput = z.infer<typeof formSchema>;
type FieldErrors = Partial<Record<keyof FormInput, string>>;

export function NewShopForm({
  submitting,
  onSubmitStart,
  onSubmitError,
}: {
  submitting: boolean;
  onSubmitStart: () => void;
  onSubmitError: (message: string) => void;
}) {
  const { isLoaded, setActive, createOrganization } = useOrganizationList();
  const seedFromClerk = useMutation(api.organizations.seedFromClerk);

  const browserTimezone = useMemo(
    () =>
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC",
    [],
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState(browserTimezone);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (slugTouched) return;
    const suggestion = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    setSlug(suggestion);
  }, [name, slugTouched]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = formSchema.safeParse({ name, slug, timezone, currency });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] as keyof FieldErrors;
        if (!nextErrors[fieldName]) nextErrors[fieldName] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    const slugShape = validateSlugShape(parsed.data.slug);
    if (!slugShape.ok) {
      setFieldErrors({
        slug:
          slugShape.code === "SLUG_RESERVED"
            ? "That slug is reserved — pick another."
            : "Use lowercase letters, numbers and dashes.",
      });
      return;
    }
    setFieldErrors({});

    if (!isLoaded || !createOrganization || !setActive) return;
    onSubmitStart();

    try {
      const newOrg = await createOrganization({
        name: parsed.data.name,
        slug: parsed.data.slug,
      });
      // Seed Convex BEFORE setActive — seedFromClerk takes clerkOrgId as an
      // arg and only requires basic auth, so we don't depend on the JWT
      // carrying the new org_id claim yet.
      await seedFromClerk({
        clerkOrgId: newOrg.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
      });
      await setActive({ organization: newOrg.id });
      window.location.assign("/dashboard");
    } catch (caught) {
      onSubmitError(
        caught instanceof Error ? caught.message : "Could not create your shop",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <Field
        label="Shop name"
        value={name}
        onChange={setName}
        error={fieldErrors.name}
        placeholder="Posh Paws Grooming"
      />
      <SlugInput
        slug={slug}
        error={fieldErrors.slug}
        onChange={(next) => {
          setSlugTouched(true);
          setSlug(next);
        }}
      />
      <Field
        label="Timezone"
        value={timezone}
        onChange={setTimezone}
        error={fieldErrors.timezone}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Currency
        </span>
        <select
          value={currency}
          onChange={(event) => setCurrency(event.target.value as Currency)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={submitting || !isLoaded}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {submitting ? "Creating shop…" : "Create shop"}
      </button>
    </form>
  );
}

export function NewShopFormError({ message }: { message: string }) {
  return <ErrorBanner>{message}</ErrorBanner>;
}
