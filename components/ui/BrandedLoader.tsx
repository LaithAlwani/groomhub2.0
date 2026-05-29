"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

/**
 * Full-screen branded loading state used during sign-in, shop opening,
 * shop creation — anywhere there's a perceptible wait between an action
 * and the next page painting.
 *
 * `progress`: omit (default) for an indeterminate spinner; pass `true`
 * for the smooth fake-progress bar used while shop creation plays out
 * (logo upload + createOrganization + seedFromClerk + setActive +
 * redirect). The bar holds at 98% if the action takes longer than 3s so
 * users don't think the page is stuck.
 */
export function BrandedLoader({
  message,
  progress = false,
}: {
  message: string;
  progress?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-white px-6 dark:bg-zinc-950"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-sky-100/60 blur-3xl dark:hidden"
      />
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
        <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-200">
          {message}
        </p>
        {progress ? <ProgressBar /> : <Spinner />}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-[#00273c] dark:border-zinc-800 dark:border-t-zinc-50"
      />
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <ShieldCheck size={12} aria-hidden />
        Secure connection
      </span>
    </div>
  );
}

function ProgressBar() {
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const intervalMs = 80;
    const target = 98;
    const duration = 3000;
    const step = (target / duration) * intervalMs;
    const tick = setInterval(() => {
      setPercent((value) => (value >= target ? target : value + step));
    }, intervalMs);
    return () => clearInterval(tick);
  }, []);
  const display = Math.min(98, Math.floor(percent));
  return (
    <>
      <div
        role="progressbar"
        aria-valuenow={display}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-8 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className="h-full rounded-full bg-[#00273c] transition-[width] duration-100 ease-linear dark:bg-zinc-50"
          style={{ width: `${display}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck size={12} aria-hidden />
          Secure connection
        </span>
        <span>{display}%</span>
      </div>
    </>
  );
}
