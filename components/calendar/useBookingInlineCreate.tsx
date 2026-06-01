"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { PetFormDialog } from "@/components/pets/PetFormDialog";

/**
 * Lets the booking dialog create a client or pet inline (stacked on top of the
 * appointment dialog) instead of forcing the user to leave the flow. On success
 * the new id is handed back so the caller can auto-select it.
 *
 * `dialogs` must be rendered by the caller; `openCreateClient` / `openCreatePet`
 * are wired to the picker's "add" affordances. Pet creation needs a `clientId`,
 * so `openCreatePet` no-ops until a client is selected.
 */
export function useBookingInlineCreate({
  clientId,
  onClientCreated,
  onPetCreated,
}: {
  clientId: Id<"clients"> | null;
  onClientCreated: (id: Id<"clients">) => void;
  onPetCreated: (id: Id<"pets">) => void;
}) {
  const [creating, setCreating] = useState<"client" | "pet" | null>(null);

  const dialogs = (
    <>
      {creating === "client" && (
        <ClientFormDialog
          clientId="new"
          onClose={() => setCreating(null)}
          onSuccess={onClientCreated}
        />
      )}
      {creating === "pet" && clientId && (
        <PetFormDialog
          clientId={clientId}
          petId="new"
          onClose={() => setCreating(null)}
          onSuccess={onPetCreated}
        />
      )}
    </>
  );

  return {
    openCreateClient: () => setCreating("client"),
    openCreatePet: () => {
      if (clientId) setCreating("pet");
    },
    dialogs,
  };
}
