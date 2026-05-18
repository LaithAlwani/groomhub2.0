import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EnsureMe } from "@/components/auth/EnsureMe";
import { OrgSwitcher } from "@/components/app/OrgSwitcher";
import { UserMenu } from "@/components/app/UserMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/create-shop");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <span className="text-base font-semibold tracking-tight">GroomHub</span>
          <div className="flex items-center gap-3">
            <OrgSwitcher />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <EnsureMe />
    </div>
  );
}
