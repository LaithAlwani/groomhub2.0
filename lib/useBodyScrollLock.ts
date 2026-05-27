import { useEffect } from "react";

/**
 * Freezes `document.body` scrolling while the calling component is mounted
 * (or `active` is true) and restores the previous value on unmount. Dialogs
 * call this so the page behind their backdrop can't scroll out from under
 * them — especially important on mobile where the dialog opens as a bottom
 * sheet over the page content. Pass `active` for dialogs that stay mounted
 * but toggle visibility via an `open` prop.
 */
export function useBodyScrollLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
