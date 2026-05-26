"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

/**
 * Branded "almost there" loading screen shown while a new shop is being
 * created — the gap between the user pressing "Create shop" and the
 * `/dashboard` redirect actually firing.
 *
 * Visuals: logo + brand + thin progress bar + secure-connection footer.
 * Centered vertically + horizontally on the page (the design mock had it
 * pinned to the top; we center per the design brief).
 *
 * Progress is a smooth fake animation from 0 → 98% over ~3 seconds. The
 * real navigation happens whenever the mutation chain completes — if that
 * comes back faster than the animation we just unmount mid-bar, which
 * still looks right because the next page paints over us. If it takes
 * longer than 3s, we hold at 98% (never auto-completes) so the user
 * doesn't think the page is stuck just because the bar is full.
 */
export function ShopCreationLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Aim to reach ~98% around the 3 second mark. Tick frequency picked so
    // the bar reads as a smooth animation rather than a chunky stepper.
    const intervalMs = 80;
    const targetPercent = 98;
    const durationMs = 3000;
    const stepPercent = (targetPercent / durationMs) * intervalMs;
    const tick = setInterval(() => {
      setProgress((value) => {
        if (value >= targetPercent) return targetPercent;
        return value + stepPercent;
      });
    }, intervalMs);
    return () => clearInterval(tick);
  }, []);

  const displayPercent = Math.min(98, Math.floor(progress));

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-6">
      {/* Soft peach glow in the bottom-right of the viewport — mirrors the
          decorative wash used on the redesigned client header card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange-100/60 blur-3xl dark:hidden"
      />
      <div className="relative w-full max-w-md text-center">
        <Image
          src="/logo_new.webp"
          alt="GroomHub"
          width={120}
          height={120}
          priority
          className="mx-auto h-28 w-28 object-contain"
        />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#00273c] dark:text-zinc-50">
          GroomHub
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Almost there&hellip;
        </p>
        <div
          role="progressbar"
          aria-valuenow={displayPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Creating your shop"
          className="mt-8 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            className="h-full rounded-full bg-[#00273c] transition-[width] duration-100 ease-linear dark:bg-zinc-50"
            style={{ width: `${displayPercent}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={12} aria-hidden />
            Secure connection
          </span>
          <span>{displayPercent}%</span>
        </div>
      </div>
    </div>
  );
}
