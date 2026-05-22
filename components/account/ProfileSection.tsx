"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

type FormInput = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormInput, string>>;

export function ProfileSection() {
  const { user, isLoaded } = useUser();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  if (!isLoaded || !user) return <SectionSkeleton />;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSavedMessage(null);

    const parsed = schema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] as keyof FieldErrors;
        if (!nextErrors[fieldName]) nextErrors[fieldName] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      await user!.update({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });
      setSavedMessage("Profile updated.");
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not save your profile",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setServerError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      await user!.setProfileImage({ file });
      setSavedMessage("Photo updated.");
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not update photo",
      );
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Profile
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your name and photo are visible to other staff at your shop.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-500">
              {(user.firstName?.[0] ?? "?").toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Change photo
          </button>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            PNG, JPG, or GIF. Up to 5 MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="First name"
            value={firstName}
            onChange={setFirstName}
            error={fieldErrors.firstName}
            autoComplete="given-name"
          />
          <Field
            label="Last name"
            value={lastName}
            onChange={setLastName}
            error={fieldErrors.lastName}
            autoComplete="family-name"
          />
        </div>
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        {savedMessage && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
            {savedMessage}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SectionSkeleton() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="h-5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </section>
  );
}
