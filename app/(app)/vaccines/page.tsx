import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { VaccinesPageBody } from "./VaccinesPageBody";

export default async function VaccinesPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  // All roles can view + create + edit; only admins (manager + owner) can
  // delete. The body component gates the trash icon on `canDelete`.
  const canDelete = role === "superAdmin" || role === "admin";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Vaccines
      </h1>
      <div className="mt-8">
        <VaccinesPageBody canDelete={canDelete} />
      </div>
    </section>
  );
}
