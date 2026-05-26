import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ConnectedAccountsSection } from "@/components/account/ConnectedAccountsSection";
import { DangerZoneSection } from "@/components/account/DangerZoneSection";
import { EmailSection } from "@/components/account/EmailSection";
import { PasswordSection } from "@/components/account/PasswordSection";
import { ProfileSection } from "@/components/account/ProfileSection";
import { SessionsSection } from "@/components/account/SessionsSection";

/**
 * "Security & Profile" account management page. Two-column flex layout on
 * desktop with the heavier forms (profile, security, sessions) on the left
 * and the smaller cards (emails, connections, danger zone) on the right.
 * Each column flexes independently so the two sides don't have to align by
 * row — the page reads as natural reading order on every breakpoint.
 */
export default function AccountPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>
      <nav
        aria-label="Breadcrumb"
        className="mt-3 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400"
      >
        <span>Settings</span>
        <ChevronRight size={12} aria-hidden className="text-zinc-300" />
        <span className="text-zinc-700 dark:text-zinc-300">
          Account Management
        </span>
      </nav>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Security &amp; Profile
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ProfileSection />
          <PasswordSection />
          <SessionsSection />
        </div>
        <div className="flex flex-col gap-6">
          <EmailSection />
          <ConnectedAccountsSection />
          <DangerZoneSection />
        </div>
      </div>
    </section>
  );
}
