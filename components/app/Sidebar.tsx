"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  PawPrint,
  Scissors,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { mapClerkOrgRole, type Role } from "@/convex/lib/roles";
import { OrgSwitcher } from "./OrgSwitcher";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  visibleTo?: ReadonlyArray<Role>;
};

const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: PawPrint },
  { href: "/services", label: "Services", icon: Scissors },
  { href: "/availability", label: "My availability", icon: CalendarClock },
  { href: "/staff", label: "Team", icon: Users, visibleTo: ["admin", "superAdmin"] },
  {
    href: "/settings/shop",
    label: "Settings",
    icon: Settings,
    visibleTo: ["admin", "superAdmin"],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-3 pt-5 pb-3">
        <OrgSwitcher />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        {NAV_LINKS.filter(
          (link) => !link.visibleTo || link.visibleTo.includes(role),
        ).map((link) => (
          <SidebarLink
            key={link.href}
            link={link}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarLink({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    pathname === link.href || pathname.startsWith(`${link.href}/`);
  const Icon = link.icon;
  const className = active
    ? "flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
    : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
  const iconClassName = active
    ? "text-blue-600 dark:text-blue-400"
    : "text-zinc-400 dark:text-zinc-500";

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      <Icon size={18} className={iconClassName} aria-hidden />
      {link.label}
    </Link>
  );
}
