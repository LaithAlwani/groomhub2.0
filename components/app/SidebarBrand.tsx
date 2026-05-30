"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ChevronsUpDown, PawPrint } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Plan } from "@/convex/lib/plans";
import { SwitcherMenu } from "./OrgSwitcherMenus";

/**
 * Sidebar header that doubles as the shop switcher. Renders the shop's logo
 * (or a paw-print placeholder) + capitalized name + the "Professional Grooming"
 * tagline. Clicking the row opens a dropdown of the user's other shops + a
 * "Create new shop" affordance — the same data the old `<OrgSwitcher />`
 * exposed, just re-skinned for the new brand-block style.
 */
export function SidebarBrand() {
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

  if (!orgLoaded || !listLoaded || !organization) return <BrandSkeleton />;
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
        className={`flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-white dark:hover:bg-zinc-900 ${switching ? "opacity-50" : ""}`}
      >
        <div className="relative shrink-0">
          <ShopAvatar logoUrl={liveOrg?.logoUrl ?? null} />
          <PlanBadge plan={liveOrg?.plan} />
        </div>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold capitalize text-[#00273c] dark:text-zinc-50">
            {organization.name}
          </span>
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            Professional Grooming
          </span>
        </span>
        <ChevronsUpDown
          size={14}
          aria-hidden
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
        />
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
        className="h-11 w-11 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00273c] text-white"
    >
      <PawPrint size={20} />
    </span>
  );
}

const PLAN_PILL_STYLES: Record<Plan, string> = {
  essential:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  professional:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  enterprise:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
};
const PLAN_PILL_LABELS: Record<Plan, string> = {
  essential: "Essential",
  professional: "Pro",
  enterprise: "Enterprise",
};

function PlanBadge({ plan }: { plan: string | undefined }) {
  if (!plan || !(plan in PLAN_PILL_STYLES)) return null;
  const key = plan as Plan;
  // Positioned to cover the bottom strip of the avatar (~25% of its height)
  // and slightly extend below it. Centered horizontally so wider labels
  // like "Enterprise" stay visually balanced against the 44px avatar.
  return (
    <span
      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide whitespace-nowrap shadow-sm ring-1 ring-white/40 dark:ring-zinc-900/40 ${PLAN_PILL_STYLES[key]}`}
    >
      {PLAN_PILL_LABELS[key]}
    </span>
  );
}

function BrandSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
