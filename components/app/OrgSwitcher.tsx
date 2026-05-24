"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ChevronDown, Store } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { SwitcherMenu } from "./OrgSwitcherMenus";

/**
 * Sidebar / topbar header that identifies the active shop and toggles a
 * dropdown of other shops the user is a member of (+ Create new shop). Only
 * the trailing chevron is clickable — the name and logo are display-only.
 * Editing shop info lives on the Settings sidebar link.
 *
 * `hideLogo` skips the shop avatar — used in the mobile topbar where the
 * centered brand mark already provides visual identity.
 */
export function OrgSwitcher({
  hideLogo = false,
}: {
  hideLogo?: boolean;
} = {}) {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, setActive, isLoaded: listLoaded } =
    useOrganizationList({ userMemberships: { infinite: false } });
  const router = useRouter();
  const liveOrg = useQuery(api.organizations.getCurrent);

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
    <div
      ref={containerRef}
      className={`relative flex w-full items-center gap-2 ${switching ? "opacity-50" : ""}`}
    >
      {!hideLogo && <ShopAvatar logoUrl={liveOrg?.logoUrl ?? null} />}
      <span className="min-w-0 flex-1 truncate text-base font-semibold capitalize text-zinc-900 dark:text-zinc-100">
        {organization.name}
      </span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={switching}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch shop"
        className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <SwitcherMenu
          memberships={memberships.map((row) => ({
            id: row.organization.id,
            name: row.organization.name,
            role: row.role,
          }))}
          currentId={organization.id}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function ShopAvatar({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
    >
      <Store size={20} />
    </span>
  );
}

function SwitcherSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-5 flex-1 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
