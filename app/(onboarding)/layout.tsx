import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PendingInvitationsBanner } from "@/components/app/PendingInvitationsBanner";
import { UserMenu } from "@/components/app/UserMenu";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { landingPage } from "@/lib/landingPage";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={landingPage.brand.logoSrc}
              alt={landingPage.brand.name}
              width={36}
              height={36}
              priority
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
              {landingPage.brand.name}
            </span>
          </Link>
          <UserMenu />
        </div>
      </header>
      <PendingInvitationsBanner />
      <main className="flex flex-1 flex-col">{children}</main>
      <MarketingFooter />
    </div>
  );
}
