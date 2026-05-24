import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClientsBoard } from "@/components/clients/ClientsBoard";
import { mapClerkOrgRole } from "@/convex/lib/roles";

export default async function ClientsPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  // Role isn't used here: any signed-in member can create or edit clients.
  // Destructive actions (archive / hard-delete) are gated on admin+/superAdmin
  // and live on the detail page.
  void mapClerkOrgRole(orgRole);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8 md:py-10">
      <ClientsBoard canEdit />
    </section>
  );
}
