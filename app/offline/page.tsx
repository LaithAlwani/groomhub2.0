import Image from "next/image";
import Link from "next/link";
import { WifiOff } from "lucide-react";

/**
 * Fallback page the service worker serves when a navigation request fails
 * and there's no cached copy of the route. Intentionally a server component
 * with no Convex / Clerk / TanStack imports so it renders without any
 * network calls — once installed in the precache, it survives any outage.
 * Cache Components (`cacheComponents: true` in next.config) handles static
 * rendering for us without needing `export const dynamic`.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 text-center dark:bg-zinc-950">
      <Image
        src="/logo_new.webp"
        alt="GroomHub"
        width={64}
        height={64}
        priority
        className="h-16 w-16 object-contain"
      />
      <span className="mt-8 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
        <WifiOff size={22} aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        We can&apos;t reach the network. Pages you&apos;ve already loaded
        should still work — open the menu and try a section you&apos;ve
        visited before. We&apos;ll sync everything the moment you&apos;re
        back online.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-linear-to-b from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow"
      >
        Try the dashboard
      </Link>
    </div>
  );
}
