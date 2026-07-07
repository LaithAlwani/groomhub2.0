"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * Shared wrapper for every form dialog in the app. Picks one of two
 * presentations at runtime:
 *
 *   - **Mobile (< 874px)**: vaul `<Drawer>` — bottom sheet with a drag
 *     handle, swipe-down-to-dismiss, momentum-based velocity threshold,
 *     and backdrop fade tied to drag distance. All gestures handled by
 *     the library so they feel native.
 *
 *   - **Desktop (≥ 874px)**: centered modal with a backdrop click-to-close
 *     + ESC handling. Same chrome (title + X close button + bordered
 *     header) so it reads consistently with the mobile sheet.
 *
 * Children render the dialog *body* — fields, footer buttons, etc. The
 * shell owns the outer card, the title bar, and the X button.
 */
const MAX_WIDTH_CLASS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
} as const;

export type DialogMaxWidth = keyof typeof MAX_WIDTH_CLASS;

export function DialogShell({
  open,
  onClose,
  title,
  children,
  maxWidth = "md",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: DialogMaxWidth;
  /** While true, backdrop click / ESC / drag-to-dismiss are all suppressed
   * — used to hold the dialog open while a mutation is mid-flight. */
  busy?: boolean;
}) {
  // 874px matches the project-wide mobile/desktop breakpoint (`min-[874px]`
  // in Tailwind classes elsewhere).
  const isMobile = useMediaQuery("(max-width: 873px)");

  // vaul handles its own scroll lock on mobile; only opt in for desktop.
  useBodyScrollLock(open && !isMobile);

  if (!open) return null;

  const widthClass = MAX_WIDTH_CLASS[maxWidth];

  if (isMobile) {
    return (
      <Drawer.Root
        open
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
        // Only the X button closes the sheet — no swipe-down, outside-tap, or
        // ESC dismissal (prevents losing an in-progress form by accident).
        dismissible={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-100 bg-zinc-900/40 backdrop-blur-sm" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed bottom-0 left-0 right-0 z-110 flex max-h-[92vh] flex-col rounded-t-2xl border border-b-0 border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-950"
          >
            {/* Drag handle — purely cosmetic; vaul tracks drags on the
                whole header region. */}
            <div
              aria-hidden
              className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700"
            />
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <Drawer.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </Drawer.Title>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // Render through a portal to `document.body` so the modal escapes whatever
  // stacking context it was triggered from (e.g. the sidebar, which sits at
  // z-60/z-70) and reliably overlays all page chrome. SSR-guarded — dialogs
  // only ever open from client interaction, so `document` is present.
  if (typeof document === "undefined") return null;

  // Backdrop click intentionally does NOT close — only the X button (or the
  // dialog's own buttons) dismisses, so a stray click can't discard a form.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-100 flex items-center justify-center bg-zinc-900/40 p-6 backdrop-blur-sm"
    >
      <div
        className={`flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
