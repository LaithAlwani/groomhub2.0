import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ServicesPageBody } from "./ServicesPageBody";

export default async function ServicesPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  const canEdit = role === "admin" || role === "superAdmin";

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
        Services
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your shop&apos;s service menu. Set durations and prices so they&apos;re ready when booking.
      </p>
      <ServicesPageBody canEdit={canEdit} />
    </section>
  );
}
