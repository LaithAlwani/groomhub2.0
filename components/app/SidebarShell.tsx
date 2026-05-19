"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Scissors, X } from "lucide-react";
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
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-zinc-950/40 md:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <div className="relative h-full">
              <Sidebar onNavigate={() => setOpen(false)} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Menu size={20} />
            </button>
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
                <Scissors size={14} strokeWidth={2.25} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                GroomHub
              </span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">{topbarRight}</div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
