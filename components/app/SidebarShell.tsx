"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { Menu } from "lucide-react";
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
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="hidden md:flex md:shrink-0">
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
        <header className="relative flex h-16 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:px-6">
          {/* Left cluster mobile: burger + store name (both open the drawer); desktop: BrandMark */}
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-16 md:flex-none md:pr-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 md:hidden"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-w-0 flex-1 truncate text-left text-base font-semibold capitalize text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300 md:hidden"
            >
              {organization?.name ?? ""}
            </button>
            <div className="hidden md:flex">
              <BrandMark />
            </div>
          </div>
          {/* Center (mobile only): GroomHub logo → Dashboard. Floats over the
              topbar's bottom edge — half of it sits below the border for a
              floating-action-button feel. Transparent background + drop shadow. */}
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            className="absolute bottom-0 left-1/2 z-50 -translate-x-1/2 translate-y-1/2 transition-transform hover:scale-105 md:hidden"
          >
            <Image
              src="/logo_new.webp"
              alt="GroomHub"
              width={56}
              height={56}
              priority
              className="h-14 w-14 object-contain drop-shadow-xl"
            />
          </Link>
          {/* Right: UserMenu */}
          <div className="ml-auto flex items-center gap-3 pl-16 md:pl-0">
            {topbarRight}
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/logo_new.webp"
        alt=""
        width={56}
        height={56}
        priority
        className="h-14 w-14 object-contain"
      />
      <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        GroomHub
      </span>
    </span>
  );
}
