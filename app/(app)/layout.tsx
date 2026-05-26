import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EnsureMe } from "@/components/auth/EnsureMe";
import { RequireOrgContext } from "@/components/auth/RequireOrgContext";
import { PendingInvitationsBanner } from "@/components/app/PendingInvitationsBanner";
import { SidebarShell } from "@/components/app/SidebarShell";
import { TopbarActions } from "@/components/app/TopbarActions";
import { CurrentLocationProvider } from "@/lib/useCurrentLocation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");

  return (
    <CurrentLocationProvider>
      <SidebarShell topbarRight={<TopbarActions />}>
        <PendingInvitationsBanner />
        {children}
      </SidebarShell>
      <EnsureMe />
      <RequireOrgContext />
    </CurrentLocationProvider>
  );
}
