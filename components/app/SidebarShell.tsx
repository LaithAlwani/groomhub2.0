"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Menu, PawPrint } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function SidebarShell({
  topbarRight,
  children,
}: {
  topbarRight: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { organization } = useOrganization();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950">
      <div className="hidden border-r border-zinc-200 md:flex md:shrink-0 dark:border-zinc-800">
        <Sidebar />
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-60 bg-zinc-950/40 md:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-70 md:hidden">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:px-8">
          {/* Mobile-only left cluster: burger + paw + shop name, all open the drawer. */}
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#00273c] text-white"
              >
                <PawPrint size={16} />
              </span>
              <span className="min-w-0 truncate text-base font-semibold capitalize text-[#00273c] dark:text-zinc-50">
                {organization?.name ?? ""}
              </span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">{topbarRight}</div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
