import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ServicesPageBody } from "./ServicesPageBody";

export default async function ServicesPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  // Any team member can add / edit services; archiving + per-location price
  // overrides stay admin-only.
  const canManage = role === "admin" || role === "superAdmin";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <ServicesPageBody canEdit canManage={canManage} />
    </section>
  );
}
