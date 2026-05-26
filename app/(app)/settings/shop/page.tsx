import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ShopSettingsBody } from "./ShopSettingsBody";

export default async function ShopSettingsPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  if (role !== "admin" && role !== "superAdmin") redirect("/dashboard");

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Shop settings
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        These details appear in every booking email and the Reply-To header so
        clients can get in touch.
      </p>
      <div className="mt-8">
        <ShopSettingsBody />
      </div>
    </section>
  );
}
