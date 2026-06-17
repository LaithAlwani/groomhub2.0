"use client";

import { useEffect, useReducer } from "react";
import { useMediaQuery } from "./useMediaQuery";
import {
  clearDeferredPrompt,
  ensureInstallPromptCapture,
  getDeferredPrompt,
  subscribeInstallPrompt,
  wasInstalled,
} from "./installPrompt";

export type InstallMode = "native" | "ios" | "hidden";

/**
 * Reports how (if at all) the app can be installed, for an on-demand "Install
 * app" menu item:
 *   - `native`  — Chromium captured a `beforeinstallprompt`; `promptInstall`
 *     opens the browser's install dialog.
 *   - `ios`     — iOS Safari (no prompt API); the caller shows Add-to-Home-
 *     Screen instructions instead.
 *   - `hidden`  — already installed/standalone, or not installable here.
 */
export function useInstallPrompt(): {
  mode: InstallMode;
  promptInstall: () => Promise<void>;
} {
  const displayModeStandalone = useMediaQuery("(display-mode: standalone)");
  const [, force] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    ensureInstallPromptCapture();
    return subscribeInstallPrompt(force);
  }, []);

  const standalone = displayModeStandalone || isIosStandalone();
  const deferred = getDeferredPrompt();

  let mode: InstallMode = "hidden";
  if (!standalone && !wasInstalled()) {
    if (deferred) mode = "native";
    else if (isIos()) mode = "ios";
  }

  async function promptInstall(): Promise<void> {
    const event = getDeferredPrompt();
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      clearDeferredPrompt();
    }
  }

  return { mode, promptInstall };
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPhoneOrPad = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ masquerades as desktop Safari but reports touch points.
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iPhoneOrPad || iPadOS;
}

function isIosStandalone(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
