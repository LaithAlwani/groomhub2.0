"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const ROLE_CHOICES = [
  { value: "org:admin", label: "Owner (full access, can delete)" },
  { value: "org:manager", label: "Admin (manage, no hard-delete)" },
  { value: "org:member", label: "Staff (own appointments only)" },
] as const;

type ClerkRole = (typeof ROLE_CHOICES)[number]["value"];

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export function InviteMemberForm({ onInvited }: { onInvited: () => void }) {
  const { organization } = useOrganization();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClerkRole>("org:member");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSavedMessage(null);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setFieldError(null);
    if (!organization) return;

    setSubmitting(true);
    try {
      await organization.inviteMember({
        emailAddress: parsed.data.email,
        role,
      });
      setEmail("");
      setSavedMessage(`Invitation sent to ${parsed.data.email}.`);
      onInvited();
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not send invitation",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Invite a teammate
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          They&apos;ll get an email with a link to join your shop.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={fieldError ?? undefined}
            autoComplete="email"
          />
        </div>
        <label className="flex flex-col gap-1.5 sm:w-72">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Role
          </span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as ClerkRole)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
          >
            {ROLE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting || !organization}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Sending…" : "Send invite"}
        </button>
      </div>

      {serverError && (
        <div className="mt-3">
          <ErrorBanner>{serverError}</ErrorBanner>
        </div>
      )}
      {savedMessage && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          {savedMessage}
        </p>
      )}
    </form>
  );
}
