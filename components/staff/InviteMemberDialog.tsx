"use client";
import { formatError } from "@/lib/formatError";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Field } from "@/components/forms/Field";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

const ROLE_CHOICES = [
  { value: "org:admin", label: "Owner (full access, can delete)" },
  { value: "org:manager", label: "Admin (manage, no hard-delete)" },
  { value: "org:member", label: "Staff (own appointments only)" },
] as const;

type ClerkRole = (typeof ROLE_CHOICES)[number]["value"];

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

/**
 * Modal version of the staff-invite form. Records an invite intent in
 * Convex (so the org webhook can apply locationIds when the membership
 * arrives) and then fires Clerk's `inviteMember` API. Closes itself on
 * success and pings `onInvited` so the parent's pending-invitations list
 * can refresh.
 */
export function InviteMemberDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const { organization } = useOrganization();
  const { current: currentLocation, locations } = useCurrentLocation();
  const sendInvitation = useAction(api.invitations.sendInvitation);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClerkRole>("org:member");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // Only Owners (`org:admin` → schema `superAdmin`) are unscoped — the
  // server refuses to restrict a superAdmin since they must see everything.
  // Admins / staff start at the inviting location; an admin can broaden
  // them later from the staff list.
  const willScopeToLocation =
    role !== "org:admin" && currentLocation !== null && locations.length > 1;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setFieldError(null);
    if (!organization) return;
    setSubmitting(true);
    try {
      // Bake the inviter's current origin into the redirect URL so the
      // invitation email always points at the host they sent it from
      // (avoids "invite goes to localhost" when the Clerk dashboard's
      // configured sign-up URL doesn't match the current environment).
      const redirectUrl = `${window.location.origin}/sign-up`;
      const result = await sendInvitation({
        email: parsed.data.email,
        role,
        locationIds: willScopeToLocation ? [currentLocation._id] : [],
        redirectUrl,
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onInvited();
      onClose();
    } catch (caught) {
      setServerError(
        formatError(caught, "Could not send invitation"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title="Invite a member"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={fieldError ?? undefined}
            autoComplete="email"
            placeholder="email@example.com"
          />
          <label className="flex flex-col gap-1.5">
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
          {willScopeToLocation && currentLocation && (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              They&apos;ll join <strong>{currentLocation.name}</strong>. Add
              them to other locations from the staff list once they accept.
            </p>
          )}
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !organization}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
    </DialogShell>
  );
}
