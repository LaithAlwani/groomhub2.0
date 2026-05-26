import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import type { Id } from "@/convex/_generated/dataModel";
import { ClientDetail } from "@/components/clients/ClientDetail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");
  const { clientId } = await params;
  const role = mapClerkOrgRole(orgRole);
  const canArchive = role === "admin" || role === "superAdmin";

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={14} />
        Back to clients
      </Link>
      <ClientDetail
        clientId={clientId as Id<"clients">}
        canEdit
        canArchive={canArchive}
      />
    </section>
  );
}
