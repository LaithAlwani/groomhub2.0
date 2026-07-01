"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, ImagePlus, Loader2 } from "lucide-react";
import type { Stage } from "./AppointmentImageStage";

/**
 * The "Add" tile for a before/after gallery. Tapping it opens a small menu
 * with "Take photo" (camera) and "Choose from library" — the parent wires
 * each to a hidden file input. Owns its own open/close + outside-click.
 */
export function AddPhotoMenu({
  stage,
  busy,
  onCamera,
  onLibrary,
}: {
  stage: Stage;
  busy: boolean;
  onCamera: () => void;
  onLibrary: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Add ${stage} photos`}
        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-orange-400 hover:bg-orange-50/50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-orange-500/60 dark:hover:bg-orange-950/20"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" aria-hidden />
        ) : (
          <>
            <ImagePlus size={18} aria-hidden />
            <span className="text-[11px] font-medium">Add</span>
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <MenuItem
            icon={<Camera size={14} aria-hidden />}
            label="Take photo"
            onClick={() => {
              setOpen(false);
              onCamera();
            }}
          />
          <MenuItem
            icon={<ImageIcon size={14} aria-hidden />}
            label="Choose from library"
            withBorder
            onClick={() => {
              setOpen(false);
              onLibrary();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  withBorder,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  withBorder?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900 ${
        withBorder ? "border-t border-zinc-100 dark:border-zinc-900" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
