import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { StaffPageBody } from "./StaffPageBody";

export default async function StaffPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  if (role !== "admin" && role !== "superAdmin") redirect("/dashboard");

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Team members
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Invite teammates and see who already has access to this shop.
      </p>
      <StaffPageBody />
    </section>
  );
}
