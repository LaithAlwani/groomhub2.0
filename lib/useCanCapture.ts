"use client";

import { useSyncExternalStore } from "react";

function subscribeCoarsePointer(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getCanCapture(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  return coarse && touch;
}

/**
 * True only when the device's PRIMARY pointer is touch (phones/tablets), where
 * an in-app camera capture makes sense. Read via `useSyncExternalStore` so
 * there's no effect-driven setState and no SSR/hydration mismatch (the server
 * snapshot is always `false` = desktop).
 */
export function useCanCapture(): boolean {
  return useSyncExternalStore(subscribeCoarsePointer, getCanCapture, () => false);
}
