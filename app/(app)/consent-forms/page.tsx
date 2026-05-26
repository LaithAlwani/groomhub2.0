import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ConsentFormsPageBody } from "./ConsentFormsPageBody";

export default async function ConsentFormsPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  // Admin + superAdmin can create + edit templates; only superAdmin can
  // delete (archive) them. Staff see the catalog as read-only.
  const canEdit = role === "superAdmin" || role === "admin";
  const canDelete = role === "superAdmin";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <ConsentFormsPageBody canEdit={canEdit} canDelete={canDelete} />
    </section>
  );
}
