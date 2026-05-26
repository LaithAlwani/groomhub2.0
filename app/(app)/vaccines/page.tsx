import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <section className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Vaccines
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        The vaccine types your shop tracks. Add them here once and pick from
        the list whenever you record a pet&apos;s vaccinations.
      </p>
      <div className="mt-8">
        <VaccinesPageBody canDelete={canDelete} />
      </div>
    </section>
  );
}
