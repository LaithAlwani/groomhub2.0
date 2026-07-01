"use client";
import { formatError } from "@/lib/formatError";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { Camera } from "lucide-react";
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
        formatError(caught, "Could not save your profile"),
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
        formatError(caught, "Could not update photo"),
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
          Public Profile
        </h2>
      </header>

      <form
        onSubmit={handleSave}
        className="flex flex-col gap-5 sm:flex-row sm:items-start"
      >
        <div className="flex shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            aria-label="Change photo"
            className="group relative h-24 w-24 rounded-full"
          >
            {/* Inner wrapper clips the image to the circle. Keeping
               overflow-hidden ONLY on this wrapper means the camera badge
               below stays a sibling outside the clip region and can sit on
               top of the image edge. */}
            <span className="block h-24 w-24 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
              {user.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-500">
                  {(user.firstName?.[0] ?? "?").toUpperCase()}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white shadow-sm transition-transform group-hover:scale-105 dark:border-zinc-950"
            >
              <Camera size={12} />
            </span>
          </button>
          <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            JPG or PNG. Max 5 MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First Name"
              value={firstName}
              onChange={setFirstName}
              error={fieldErrors.firstName}
              autoComplete="given-name"
            />
            <Field
              label="Last Name"
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
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
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
