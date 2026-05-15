import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            GroomHub
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/sign-in"
              className="rounded-full px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        &copy; 2026 GroomHub
      </footer>
    </div>
  );
}
