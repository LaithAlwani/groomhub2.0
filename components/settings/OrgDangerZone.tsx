"use client";

import { useState } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { LogOut, Trash2 } from "lucide-react";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Bottom section of the organization settings page. Two destructive
 * actions:
 *
 *  - **Leave** (any member): removes the caller from this org's roster.
 *    Their membership row is soft-marked inactive via the
 *    `organizationMembership.deleted` webhook. They land back at
 *    `/onboarding/create-shop` since they no longer have an active org.
 *
 *  - **Delete** (superAdmin only): destroys the Clerk org entirely. The
 *    `organization.deleted` webhook fires and `convex/clerkSync.ts` soft-
 *    deletes the row; the cron in `orgCleanup.ts` hard-deletes after the
 *    30-day grace period. Guarded by a phrase-typing confirm to prevent
 *    accidents on a single tap.
 */
export function OrgDangerZone({ orgName }: { orgName: string }) {
  const { organization } = useOrganization();
  const { user } = useUser();
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const canDelete = role === "superAdmin";

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [busy, setBusy] = useState<"leave" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    if (!organization || !user) return;
    setBusy("leave");
    setError(null);
    try {
      await organization.removeMember(user.id);
      // Belt-and-suspenders redirect; middleware would catch this on the
      // next nav too, but the inline redirect avoids a blank flash.
      window.location.assign("/onboarding/create-shop");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not leave organization",
      );
      setConfirmLeave(false);
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!organization) return;
    setBusy("delete");
    setError(null);
    try {
      await organization.destroy();
      window.location.assign("/onboarding/create-shop");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not delete organization",
      );
      setConfirmDelete(false);
      setBusy(null);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-red-200 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-950/20">
      <h2 className="text-base font-semibold text-red-900 dark:text-red-200">
        Danger zone
      </h2>
      <p className="mt-1 text-xs text-red-800/80 dark:text-red-200/70">
        These actions can&apos;t be undone immediately. Leaving removes only
        your access; deleting removes the entire shop.
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs text-red-900 dark:border-red-900/60 dark:bg-zinc-950 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          <LogOut size={14} />
          Leave organization
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
          >
            <Trash2 size={14} />
            Delete organization
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this organization?"
        description={
          <>
            You&apos;ll lose access to{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {orgName}
            </span>{" "}
            immediately. An admin can re-invite you later if needed.
          </>
        }
        confirmLabel="Leave"
        tone="danger"
        busy={busy === "leave"}
        onConfirm={handleLeave}
        onCancel={() => setConfirmLeave(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${orgName}?`}
        description={
          <>
            <p>
              This wipes every appointment, client, pet, service, and team
              member tied to{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {orgName}
              </span>
              . The slug becomes available again immediately; data is
              hard-deleted from backups after 30 days.
            </p>
            <p className="mt-3">
              Type{" "}
              <span className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                {orgName}
              </span>{" "}
              below to confirm.
            </p>
            <input
              type="text"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              autoFocus
            />
          </>
        }
        confirmLabel="Delete permanently"
        tone="danger"
        busy={busy === "delete"}
        disableConfirm={deletePhrase.trim() !== orgName.trim()}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeletePhrase("");
        }}
      />
    </section>
  );
}
