"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import {
  CalendarClock,
  CalendarDays,
  FileSignature,
  LayoutDashboard,
  MapPin,
  PawPrint,
  Plus,
  Scissors,
  Settings,
  Syringe,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { mapClerkOrgRole, type Role } from "@/convex/lib/roles";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { AppointmentDialog } from "@/components/calendar/AppointmentDialog";
import { LocationSwitcher } from "./LocationSwitcher";
import { SidebarBrand } from "./SidebarBrand";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  visibleTo?: ReadonlyArray<Role>;
};

const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: PawPrint },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/services", label: "Services", icon: Scissors },
  { href: "/vaccines", label: "Vaccines", icon: Syringe },
  { href: "/consent-forms", label: "Consent forms", icon: FileSignature },
  { href: "/availability", label: "My availability", icon: CalendarClock },
  { href: "/staff", label: "Staff", icon: Users, visibleTo: ["admin", "superAdmin"] },
  {
    href: "/settings/locations",
    label: "Locations",
    icon: MapPin,
    visibleTo: ["admin", "superAdmin"],
  },
  {
    href: "/settings/import",
    label: "Import data",
    icon: Upload,
    visibleTo: ["admin", "superAdmin"],
  },
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
  const [bookingOpen, setBookingOpen] = useState(false);
  const { current: currentLocation } = useCurrentLocation();
  const locationTimezone =
    currentLocation?.timezone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="px-5 py-5">
        <SidebarBrand />
        <LocationSwitcher />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
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

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            setBookingOpen(true);
            onNavigate?.();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00273c] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#013a58] hover:shadow"
        >
          <Plus size={16} />
          New appointment
        </button>
      </div>

      {bookingOpen && (
        <AppointmentDialog
          appointmentId="new"
          locationTimezone={locationTimezone}
          onClose={() => setBookingOpen(false)}
        />
      )}
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
    ? "flex items-center gap-3 rounded-lg bg-linear-to-r from-orange-500 to-orange-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm"
    : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-[#00273c] dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50";
  const iconClassName = active
    ? "text-white"
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
