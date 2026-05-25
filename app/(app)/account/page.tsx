import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConnectedAccountsSection } from "@/components/account/ConnectedAccountsSection";
import { DangerZoneSection } from "@/components/account/DangerZoneSection";
import { EmailSection } from "@/components/account/EmailSection";
import { PasswordSection } from "@/components/account/PasswordSection";
import { ProfileSection } from "@/components/account/ProfileSection";
import { SessionsSection } from "@/components/account/SessionsSection";

export default function AccountPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Manage your account
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your profile, sign-in details, and security settings.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <ProfileSection />
        <EmailSection />
        <PasswordSection />
        <ConnectedAccountsSection />
        <SessionsSection />
        <DangerZoneSection />
      </div>
    </section>
  );
}
