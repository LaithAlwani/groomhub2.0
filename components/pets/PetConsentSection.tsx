"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { SignConsentDialog } from "@/components/consent/SignConsentDialog";
import { SignedFormsTable } from "@/components/consent/SignedFormsTable";

/**
 * Signed consent forms for a pet, with the "Sign new form" action. This is the
 * primary signing surface now that consents are per-pet.
 */
export function PetConsentSection({ petId }: { petId: Id<"pets"> }) {
  const signed = useQuery(api.consentForms.listForPet, { petId });
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const canDelete = role === "superAdmin";
  const [signOpen, setSignOpen] = useState(false);
  const count = signed?.length ?? 0;

  return (
    <section className="mt-8">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Signed forms
          {signed !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setSignOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
        >
          <Plus size={14} />
          Sign new form
        </button>
      </header>

      <SignedFormsTable rows={signed} canDelete={canDelete} />

      {signOpen && (
        <SignConsentDialog petId={petId} onClose={() => setSignOpen(false)} />
      )}
    </section>
  );
}
