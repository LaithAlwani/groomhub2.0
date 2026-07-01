import type { ClientImport } from "@/lib/import/parseImport";

/**
 * Shape one parsed client into the row `convex/imports.ts` `commitBatch`
 * expects. Every imported client is a fresh insert (`kind: "insert"`); its
 * pets and legacy appointments ride along on the same row.
 */
export function toCommitRow(client: ClientImport, index: number) {
  return {
    rowId: String(index),
    client: {
      kind: "insert" as const,
      data: {
        fullName: client.fullName,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        altPhones: client.altPhones,
        email: client.email,
        addressLine1: client.addressLine1,
        addressLine2: client.addressLine2,
        city: client.city,
        state: client.state,
        postalCode: client.postalCode,
        country: client.country,
        notes: client.notes,
      },
    },
    pets: client.pets.length > 0 ? client.pets : undefined,
    legacy:
      client.legacyAppointments.length > 0
        ? client.legacyAppointments
        : undefined,
  };
}
