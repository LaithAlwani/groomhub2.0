import { useEffect, useState } from "react";

/**
 * Reactive `window.matchMedia` wrapper. The initial state is read
 * synchronously from `window.matchMedia(...).matches` so the very first
 * render already reflects the correct value — important for components
 * like dialogs that pick a different layout per breakpoint and would
 * otherwise flash the wrong variant for one frame before `useEffect`
 * resolved.
 *
 * SSR: returns `false` when `window` is undefined. Dialogs are only
 * rendered after user interaction (post-hydration), so this branch
 * never fires for them — the synchronous client read always wins.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    function handler(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
