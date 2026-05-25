"use client";

import { useUser } from "@clerk/nextjs";
import { Laptop, Smartphone } from "lucide-react";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type SessionWithActivitiesResource = Awaited<
  ReturnType<ClerkUser["getSessions"]>
>[number];

/**
 * One row in the SessionsSection list. Renders device/browser, last-active
 * time, approximate location, and a Revoke button — disabled when this is
 * the row for the current session (the user revokes "this device" by
 * signing out, not by killing the session that's rendering the UI).
 */
export function SessionRow({
  session,
  isCurrent,
  busy,
  onRevoke,
}: {
  session: SessionWithActivitiesResource;
  isCurrent: boolean;
  busy: boolean;
  onRevoke: () => void;
}) {
  const activity = session.latestActivity;
  const isMobile = activity?.isMobile;
  const Icon = isMobile ? Smartphone : Laptop;
  const browser = activity?.browserName ?? "Unknown browser";
  const os = activity?.deviceType ?? activity?.country ?? "";
  const location = [activity?.city, activity?.country].filter(Boolean).join(", ");
  const lastActive = session.lastActiveAt
    ? new Date(session.lastActiveAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="flex min-w-0 items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-zinc-400" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            <span>
              {browser}
              {os ? ` · ${os}` : ""}
            </span>
            {isCurrent && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                This device
              </span>
            )}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {[location, lastActive].filter(Boolean).join(" · ") ||
              "No activity data"}
          </p>
        </div>
      </div>
      {!isCurrent && (
        <button
          type="button"
          disabled={busy}
          onClick={onRevoke}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
        >
          {busy ? "Revoking…" : "Revoke"}
        </button>
      )}
    </li>
  );
}
