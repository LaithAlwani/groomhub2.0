import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import type { Id } from "@/convex/_generated/dataModel";
import { PetDetailBody } from "@/components/pets/PetDetailBody";

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const { petId } = await params;
  const role = mapClerkOrgRole(orgRole);
  const canArchive = role === "admin" || role === "superAdmin";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <PetDetailBody
        petId={petId as Id<"pets">}
        canEdit
        canArchive={canArchive}
      />
    </section>
  );
}
