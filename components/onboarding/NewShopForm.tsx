"use client";

import { useState } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { validateSlugShape } from "@/convex/lib/reservedSlugs";
import { compressImage } from "@/lib/imageCompress";
import { NORTH_AMERICA_TIMEZONES } from "@/lib/timezones";
import { ShopLogoUploader } from "./ShopLogoUploader";
import { SlugInput } from "./SlugInput";
import {
  newShopSchema,
  SUPPORTED_CURRENCIES,
  type Currency,
  type NewShopFieldErrors,
  useNewShopForm,
} from "./useNewShopForm";

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
  const generateLogoUploadUrl = useMutation(api.organizations.generateLogoUploadUrl);

  const form = useNewShopForm();
  const [fieldErrors, setFieldErrors] = useState<NewShopFieldErrors>({});

  async function uploadLogo(file: File): Promise<Id<"_storage">> {
    const compressed = await compressImage(file, { maxDim: 512, quality: 0.85 });
    const uploadUrl = await generateLogoUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": compressed.type || file.type },
      body: compressed,
    });
    if (!response.ok) throw new Error("Logo upload failed");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = newShopSchema.safeParse({
      name: form.name,
      slug: form.slug,
      timezone: form.timezone,
      currency: form.currency,
      shopEmail: form.shopEmail,
    });
    if (!parsed.success) {
      const nextErrors: NewShopFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] as keyof NewShopFieldErrors;
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
      const logoStorageId = form.logoFile ? await uploadLogo(form.logoFile) : undefined;
      const newOrg = await createOrganization({
        name: parsed.data.name,
        slug: parsed.data.slug,
      });
      await seedFromClerk({
        clerkOrgId: newOrg.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
        logoStorageId,
        contactEmail: parsed.data.shopEmail,
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
      <ShopLogoUploader
        file={form.logoFile}
        onChange={form.setLogoFile}
        disabled={submitting}
      />
      <Field
        label="Shop name"
        value={form.name}
        onChange={form.setName}
        error={fieldErrors.name}
        placeholder="Posh Paws Grooming"
      />
      <SlugInput slug={form.slug} error={fieldErrors.slug} onChange={form.setSlug} />
      <Field
        label="Shop email"
        type="email"
        inputMode="email"
        value={form.shopEmail}
        onChange={form.setShopEmail}
        error={fieldErrors.shopEmail}
        placeholder="hello@yourshop.com"
      />
      <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Clients reply to this address when they get booking confirmations. We
        prefilled it with your own email — change it to a shared shop inbox if
        you have one.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Timezone
        </span>
        <select
          value={form.timezone}
          onChange={(event) => form.setTimezone(event.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        >
          {NORTH_AMERICA_TIMEZONES.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>
        {fieldErrors.timezone && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.timezone}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Currency
        </span>
        <select
          value={form.currency}
          onChange={(event) => form.setCurrency(event.target.value as Currency)}
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
        className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {submitting ? "Creating shop…" : "Create shop"}
      </button>
    </form>
  );
}

export function NewShopFormError({ message }: { message: string }) {
  return <ErrorBanner>{message}</ErrorBanner>;
}
