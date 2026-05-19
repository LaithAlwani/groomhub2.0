import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ClientsPageBody } from "./ClientsPageBody";

export default async function ClientsPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  // Role is intentionally not used here: any signed-in member can create or
  // edit clients. Destructive actions (archive / hard-delete) are still gated
  // on admin+/superAdmin and live on the detail page.
  void mapClerkOrgRole(orgRole);

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Clients
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Pet owners and their grooming history. Search by name, phone number, or
        the last few digits.
      </p>
      <ClientsPageBody canEdit />
    </section>
  );
}
