"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { Download, LogOut, Settings, UserRound } from "lucide-react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { InstallInstructionsModal } from "./InstallInstructionsModal";

/**
 * Custom replacement for Clerk's `<UserButton />`. Avatar trigger opens a
 * dropdown with the signed-in user's name, email, and links to the in-app
 * account management page + sign out.
 */
export function UserMenu() {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const { mode: installMode, promptInstall } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [installInstructionsOpen, setInstallInstructionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isLoaded || !user) return <AvatarSkeleton />;

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "Your account";
  const email = user.primaryEmailAddress?.emailAddress;

  function handleManageAccount() {
    setOpen(false);
    router.push("/account");
  }

  async function handleSignOut() {
    setOpen(false);
    await clerk.signOut(() => window.location.assign("/"));
  }

  async function handleInstall() {
    setOpen(false);
    if (installMode === "native") {
      await promptInstall();
    } else {
      setInstallInstructionsOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <AvatarImage imageUrl={user.imageUrl} initials={initialsFor(user)} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {fullName}
            </p>
            {email && (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {email}
              </p>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleManageAccount}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Settings size={16} />
            Manage account
          </button>
          {installMode !== "hidden" && (
            <div className="px-3 py-2 md:hidden">
              <button
                type="button"
                role="menuitem"
                onClick={handleInstall}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
              >
                <Download size={16} />
                Install app
              </button>
            </div>
          )}
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}

      {installInstructionsOpen && (
        <InstallInstructionsModal
          onClose={() => setInstallInstructionsOpen(false)}
        />
      )}
    </div>
  );
}

function AvatarImage({
  imageUrl,
  initials,
}: {
  imageUrl: string | null | undefined;
  initials: string;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 object-cover"
      />
    );
  }
  if (initials) return <span aria-hidden>{initials}</span>;
  return <UserRound size={18} aria-hidden />;
}

function AvatarSkeleton() {
  return (
    <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
  );
}

function initialsFor(user: NonNullable<ReturnType<typeof useUser>["user"]>): string {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  const combined = `${first}${last}`.trim().toUpperCase();
  if (combined) return combined;
  return user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ?? "";
}
