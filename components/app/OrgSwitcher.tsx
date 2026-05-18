"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

/**
 * Custom replacement for Clerk's `<OrganizationSwitcher />`.
 * Shows the active shop, lets the user switch or create a new one, styled
 * to match the rest of the app.
 */
export function OrgSwitcher() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, setActive, isLoaded: listLoaded } =
    useOrganizationList({ userMemberships: { infinite: false } });
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
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

  if (!orgLoaded || !listLoaded || !organization) return <SwitcherSkeleton />;
  const memberships = userMemberships?.data ?? [];

  async function handleSelect(targetOrgId: string) {
    if (!setActive) return;
    if (targetOrgId === organization?.id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await setActive({ organization: targetOrgId });
      setOpen(false);
      window.location.assign("/dashboard");
    } catch {
      setSwitching(false);
    }
  }

  function handleCreate() {
    setOpen(false);
    router.push("/onboarding/create-shop");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={switching}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        <span className="max-w-[180px] truncate">{organization.name}</span>
        <ChevronsUpDown
          size={14}
          className="text-zinc-400 dark:text-zinc-500"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {memberships.map((membership) => {
              const target = membership.organization;
              const isCurrent = target.id === organization.id;
              return (
                <li key={target.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(target.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <span className="flex flex-col">
                      <span className="truncate font-medium">{target.name}</span>
                      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {membership.role.replace("org:", "")}
                      </span>
                    </span>
                    {isCurrent && (
                      <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              role="menuitem"
              onClick={handleCreate}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Plus size={16} />
              Create new shop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SwitcherSkeleton() {
  return (
    <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
  );
}
