import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { LocationsBody } from "./LocationsBody";

export default async function LocationsSettingsPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const role = mapClerkOrgRole(orgRole);
  if (role !== "admin" && role !== "superAdmin") redirect("/dashboard");

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
        Locations
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Each location keeps its own calendar, staff schedules, and timezone.
        Clients and pets are shared across every location.
      </p>
      <div className="mt-8">
        <LocationsBody />
      </div>
    </section>
  );
}
