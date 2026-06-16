"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PetProfileCard } from "./PetProfileCard";
import { PetMedicalSection } from "./PetMedicalSection";
import { PetVaccinationsSection } from "./PetVaccinationsSection";
import { PetAppointmentsSection } from "./PetAppointmentsSection";
import { PetFormDialog } from "./PetFormDialog";

/**
 * Pet detail page body. Loads the pet + owner via `pets.getDetail` and stacks
 * the profile card, medical/vaccinations, and pet-scoped appointment history.
 * Per-pet consents and before/after photo galleries land here in later phases.
 */
export function PetDetailBody({
  petId,
  canEdit,
  canArchive,
}: {
  petId: Id<"pets">;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const pet = useQuery(api.pets.getDetail, { id: petId });
  const archive = useMutation(api.pets.archive);
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (pet === undefined) return <DetailSkeleton />;
  if (pet === null) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        This pet doesn&apos;t exist or you don&apos;t have access to it.
      </p>
    );
  }

  async function handleArchive() {
    setArchiving(true);
    setErrorMessage(null);
    try {
      await archive({ id: petId });
      setConfirmArchive(false);
      if (pet?.owner) router.push(`/clients/${pet.owner.id}`);
      else router.push("/clients");
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not archive",
      );
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <PetProfileCard
        pet={pet}
        canEdit={canEdit}
        canArchive={canArchive}
        onEdit={() => setEditing(true)}
        onArchive={() => setConfirmArchive(true)}
      />
      {errorMessage && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}
      <PetAppointmentsSection petId={petId} />
      <PetVaccinationsSection pet={pet} />
      <PetMedicalSection pet={pet} />

      {editing && (
        <PetFormDialog
          clientId={pet.clientId}
          petId={petId}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog
        open={confirmArchive}
        title="Archive pet?"
        description={
          <>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              &ldquo;{pet.name}&rdquo;
            </span>{" "}
            will be hidden from booking lists. Past appointments stay intact and
            you can restore later.
          </>
        }
        confirmLabel="Archive"
        tone="danger"
        busy={archiving}
        onConfirm={handleArchive}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-48 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
