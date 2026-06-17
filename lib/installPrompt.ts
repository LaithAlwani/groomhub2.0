/**
 * Module-level capture of the browser's `beforeinstallprompt` event. The event
 * can fire before any React component mounts, so we register the listeners as
 * early as possible (`ensureInstallPromptCapture` is called from the root
 * service-worker island) and stash the deferred event here for the install
 * modal to use later. Subscribers are notified when the event arrives or when
 * the app reports itself installed.
 *
 * This is a plain client util (no JSX) — safe to import from client components.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let initialized = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Idempotently attach the global install listeners (client only). */
export function ensureInstallPromptCapture(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Stop Chrome's mini-infobar so we can present our own prompt later.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function wasInstalled(): boolean {
  return installed;
}

/** Drop the deferred event after it's been used (it's single-use). */
export function clearDeferredPrompt(): void {
  deferredPrompt = null;
  notify();
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
