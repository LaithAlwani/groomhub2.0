"use client";

import { useState } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { validateSlugShape } from "@/convex/lib/reservedSlugs";
import { compressImage } from "@/lib/imageCompress";
import {
  INTERNATIONAL_TIMEZONES,
  NORTH_AMERICA_TIMEZONES,
} from "@/lib/timezones";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
        required
      />
      <SlugInput slug={form.slug} error={fieldErrors.slug} onChange={form.setSlug} />
      <div className="flex flex-col gap-1.5">
        <Field
          label="Shop email"
          type="email"
          inputMode="email"
          value={form.shopEmail}
          onChange={form.setShopEmail}
          error={fieldErrors.shopEmail}
          placeholder="hello@yourshop.com"
          required
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Clients reply to this address when they get booking confirmations. We
          prefilled it with your own email — change it to a shared shop inbox
          if you have one.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-[#00273c] dark:text-zinc-100">
            Timezone
            <RequiredMark />
          </span>
          <select
            value={form.timezone}
            onChange={(event) => form.setTimezone(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900"
          >
            <optgroup label="North America">
              {NORTH_AMERICA_TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="International">
              {INTERNATIONAL_TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </optgroup>
          </select>
          {fieldErrors.timezone && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.timezone}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-[#00273c] dark:text-zinc-100">
            Currency
            <RequiredMark />
          </span>
          <select
            value={form.currency}
            onChange={(event) => form.setCurrency(event.target.value as Currency)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting || !isLoaded}
        className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#00273c] px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#013a58] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {submitting ? "Creating shop…" : "Create shop"}
      </button>
    </form>
  );
}

export function NewShopFormError({ message }: { message: string }) {
  return <ErrorBanner>{message}</ErrorBanner>;
}
