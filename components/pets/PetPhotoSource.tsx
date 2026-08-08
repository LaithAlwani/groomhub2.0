"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, ImagePlus } from "lucide-react";
import { useCanCapture } from "@/lib/useCanCapture";

/**
 * "Add / Replace photo" control for the pet uploader. On phones/tablets it opens
 * a menu with Take photo (camera) / Choose from library; on desktop it skips the
 * menu and opens the library picker. The parent handles the chosen file.
 */
export function PetPhotoSource({
  label,
  busy,
  onFile,
}: {
  label: string;
  busy: boolean;
  onFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const canCapture = useCanCapture();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative">
      {/* Camera capture (touch only) + a plain library picker. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() =>
          canCapture
            ? setMenuOpen((open) => !open)
            : libraryInputRef.current?.click()
        }
        disabled={busy}
        aria-haspopup={canCapture ? "menu" : undefined}
        aria-expanded={canCapture ? menuOpen : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        <ImagePlus size={14} />
        {label}
      </button>
      {menuOpen && canCapture && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <MenuItem
            icon={<Camera size={14} aria-hidden />}
            label="Take photo"
            onClick={() => {
              setMenuOpen(false);
              cameraInputRef.current?.click();
            }}
          />
          <MenuItem
            icon={<ImageIcon size={14} aria-hidden />}
            label="Choose from library"
            withBorder
            onClick={() => {
              setMenuOpen(false);
              libraryInputRef.current?.click();
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
