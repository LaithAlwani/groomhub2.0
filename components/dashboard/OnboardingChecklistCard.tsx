"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { api } from "@/convex/_generated/api";

type Step = { label: string; href: string; done: boolean; hint?: string };
type CardContent = { title: string; subtitle: string; steps: Step[] };

const STORAGE_PREFIX = "groomhub:onboardingCard:";

/**
 * Role-aware first-run card. Owners/admins get a setup checklist (shop hours +
 * services are pre-checked since they're seeded); groomers get a one-step
 * "confirm your working hours" prompt. Hides once every step is done or the
 * user dismisses it (persisted per-org in localStorage).
 */
export function OnboardingChecklistCard() {
  const state = useQuery(api.onboarding.getOnboardingState);
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let value = false;
    try {
      value = window.localStorage.getItem(STORAGE_PREFIX + orgId) === "true";
    } catch {
      value = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration of the dismissal flag from localStorage on mount / org switch
    setDismissed(value);
  }, [orgId]);

  if (state === undefined || state === null || dismissed) return null;

  const { title, subtitle, steps } =
    state.role === "staff" ? staffContent(state) : adminContent(state);

  if (steps.every((step) => step.done)) return null;
  const doneCount = steps.filter((step) => step.done).length;

  function handleDismiss() {
    setDismissed(true);
    if (!orgId) return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + orgId, "true");
    } catch {
      // localStorage unavailable (private mode) — card reappears next load.
    }
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-linear-to-br from-orange-50 to-white p-5 shadow-sm dark:border-orange-900/40 dark:from-orange-950/30 dark:to-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white"
          >
            <Sparkles size={16} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              {subtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/60 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {doneCount} of {steps.length} done
      </p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {steps.map((step) => (
          <StepRow key={step.label} step={step} />
        ))}
      </ol>
    </section>
  );
}

function StepRow({ step }: { step: Step }) {
  if (step.done) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check size={12} />
        </span>
        <span className="text-zinc-500 line-through dark:text-zinc-500">
          {step.label}
        </span>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={step.href}
        className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/70 dark:hover:bg-zinc-900"
      >
        <span className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
        <span className="flex-1 font-medium text-zinc-800 dark:text-zinc-200">
          {step.label}
          {step.hint && (
            <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {step.hint}
            </span>
          )}
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function adminContent(state: {
  hasShopHours: boolean;
  hasServices: boolean;
  hasClient: boolean;
  hasPet: boolean;
  hasAppointment: boolean;
}): CardContent {
  return {
    title: "Finish setting up your shop",
    subtitle: "A few steps and you'll be booking appointments.",
    steps: [
      { label: "Set your shop hours", href: "/settings/locations", done: state.hasShopHours },
      { label: "Review your services", href: "/services", done: state.hasServices },
      {
        label: "Add your first client & pet",
        href: "/clients",
        done: state.hasClient && state.hasPet,
      },
      { label: "Book your first appointment", href: "/calendar", done: state.hasAppointment },
    ],
  };
}

function staffContent(state: { availabilityConfirmed: boolean }): CardContent {
  return {
    title: "Welcome to the team!",
    subtitle: "One quick thing so clients can book you.",
    steps: [
      {
        label: "Confirm your working hours",
        href: "/availability",
        done: state.availabilityConfirmed,
        hint: "You start on the shop's default hours — review and adjust them.",
      },
    ],
  };
}
