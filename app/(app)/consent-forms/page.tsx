import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ConsentFormsPageBody } from "./ConsentFormsPageBody";

export default async function ConsentFormsPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  // Any team member (staff+) can create + edit templates; only superAdmin can
  // delete (archive) them.
  const canDelete = mapClerkOrgRole(orgRole) === "superAdmin";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <ConsentFormsPageBody canEdit canDelete={canDelete} />
    </section>
  );
}
