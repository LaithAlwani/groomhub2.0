"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

/**
 * Schema is built per-render based on `hasExistingPassword`. When the user
 * has no password yet (Google-only signup), the `currentPassword` field
 * isn't shown and shouldn't be required — otherwise the form silently
 * fails validation against an invisible field.
 */
function buildSchema(hasExistingPassword: boolean) {
  return z
    .object({
      currentPassword: hasExistingPassword
        ? z.string().min(1, "Enter your current password")
        : z.string().optional(),
      newPassword: z.string().min(8, "At least 8 characters"),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords don't match",
    });
}

type FormInput = {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
};
type FieldErrors = Partial<Record<keyof FormInput, string>>;

export function PasswordSection() {
  const { user, isLoaded } = useUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isLoaded || !user) return null;

  const hasExistingPassword = user.passwordEnabled;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSavedMessage(null);

    const parsed = buildSchema(hasExistingPassword).safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
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
      await user!.updatePassword({
        currentPassword: hasExistingPassword
          ? parsed.data.currentPassword
          : undefined,
        newPassword: parsed.data.newPassword,
        signOutOfOtherSessions: signOutOthers,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSavedMessage("Password updated.");
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not update password",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Security
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {hasExistingPassword
            ? "Pick a new password. We recommend signing out of other devices."
            : "You currently sign in via email link or Google. Set a password if you want one as a backup."}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {hasExistingPassword && (
          <Field
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={fieldErrors.currentPassword}
            autoComplete="current-password"
            required
          />
        )}
        <Field
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          error={fieldErrors.newPassword}
          autoComplete="new-password"
          required
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(event) => setSignOutOthers(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Sign out of all other devices
        </label>
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
            {saving ? "Updating…" : hasExistingPassword ? "Update password" : "Set password"}
          </button>
        </div>
      </form>
    </section>
  );
}
