"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { landingPage } from "@/lib/landingPage";
import { marketingHref } from "@/lib/urls";

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800/70 dark:bg-[#00273c]/80">
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

        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-700 md:flex dark:text-zinc-200">
          {landingPage.nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-orange-700 dark:hover:text-orange-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={marketingHref(landingPage.nav.signInHref)}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {landingPage.nav.signInLabel}
          </Link>
          <Link
            href={marketingHref(landingPage.nav.primaryCtaHref)}
            className="rounded-full bg-linear-to-r from-orange-600 to-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] hover:shadow"
          >
            {landingPage.nav.primaryCtaLabel}
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
          className="rounded-md p-2 text-zinc-700 transition-colors hover:bg-zinc-100 md:hidden dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-200 bg-white px-6 py-4 md:hidden dark:border-zinc-800 dark:bg-[#00273c]">
          <nav className="flex flex-col gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {landingPage.nav.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={marketingHref(landingPage.nav.signInHref)}
              onClick={() => setOpen(false)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {landingPage.nav.signInLabel}
            </Link>
            <Link
              href={marketingHref(landingPage.nav.primaryCtaHref)}
              onClick={() => setOpen(false)}
              className="rounded-full bg-linear-to-r from-orange-600 to-orange-500 px-4 py-2 text-center text-sm font-medium text-white shadow-sm"
            >
              {landingPage.nav.primaryCtaLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
