import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ImportFlow } from "./ImportFlow";

export default async function ImportDataPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  if (role !== "admin" && role !== "superAdmin") redirect("/dashboard");

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <ImportFlow />
    </section>
  );
}
