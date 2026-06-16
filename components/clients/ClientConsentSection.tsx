"use client";

import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { SignedFormsTable } from "@/components/consent/SignedFormsTable";

/**
 * Read-only roll-up of every consent form signed across this client's pets.
 * Signing happens on the pet (or appointment) page now, so there's no
 * "Sign new form" action here — just a per-pet-labelled overview + download.
 */
export function ClientConsentSection({
  clientId,
}: {
  clientId: Id<"clients">;
}) {
  const signed = useQuery(api.consentForms.listForClient, { clientId });
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const canDelete = role === "superAdmin";
  const count = signed?.length ?? 0;

  return (
    <section className="mt-8">
      <header className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Signed forms
          {signed !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
      </header>

      <SignedFormsTable rows={signed} canDelete={canDelete} showPet />
    </section>
  );
}
