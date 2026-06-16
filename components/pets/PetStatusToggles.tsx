"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Ban, Heart } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Status toggle buttons on the pet detail page. Replaces the Deceased/Banned
 * switches that used to live in the add/edit form. Each button flips the flag
 * immediately via `pets.setFlags`. Both flags block new bookings; banned also
 * tints the pet card red across the app.
 */
export function PetStatusToggles({
  petId,
  isDeceased,
  isBanned,
}: {
  petId: Id<"pets">;
  isDeceased: boolean;
  isBanned: boolean;
}) {
  const setFlags = useMutation(api.pets.setFlags);
  const [busy, setBusy] = useState<"deceased" | "banned" | null>(null);

  async function toggle(flag: "deceased" | "banned", next: boolean) {
    setBusy(flag);
    try {
      await setFlags({
        id: petId,
        ...(flag === "deceased" ? { isDeceased: next } : { isBanned: next }),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <ToggleButton
        active={isDeceased}
        busy={busy === "deceased"}
        onClick={() => toggle("deceased", !isDeceased)}
        icon={<Heart size={13} aria-hidden />}
        label="Deceased"
        activeClass="border-zinc-300 bg-zinc-200 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      />
      <ToggleButton
        active={isBanned}
        busy={busy === "banned"}
        onClick={() => toggle("banned", !isBanned)}
        icon={<Ban size={13} aria-hidden />}
        label="Banned"
        activeClass="border-red-300 bg-red-100 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
      />
    </div>
  );
}

function ToggleButton({
  active,
  busy,
  onClick,
  icon,
  label,
  activeClass,
}: {
  active: boolean;
  busy: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        active
          ? activeClass
          : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
