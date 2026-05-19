"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { addDaysIso, todayIsoDate } from "@/lib/time";

export function MyAvailabilityBody() {
  // Show 90 days of overrides ahead (and 30 behind for history) — bounded scan
  // on the per-staff date index.
  const fromDate = addDaysIso(todayIsoDate(), -30);
  const toDate = addDaysIso(todayIsoDate(), 90);

  const weekly = useQuery(api.availability.myWeekly, {});
  const overrides = useQuery(api.availability.myOverridesInRange, {
    fromDate,
    toDate,
  });
  const upsertWeekly = useMutation(api.availability.upsertMyWeekly);
  const upsertOverride = useMutation(api.availability.upsertMyOverride);
  const clearOverride = useMutation(api.availability.clearMyOverride);

  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  if (weekly === undefined || overrides === undefined) return <EditorSkeleton />;

  return (
    <AvailabilityEditor
      weeklyRanges={weekly.map(({ weekday, startMin, endMin }) => ({
        weekday,
        startMin,
        endMin,
      }))}
      overrides={overrides.map(({ date, kind, slots }) => ({
        date,
        kind,
        slots,
      }))}
      canEdit
      savingWeekly={savingWeekly}
      savingOverride={savingOverride}
      onSaveWeekly={async (ranges) => {
        setSavingWeekly(true);
        try {
          await upsertWeekly({ ranges });
        } finally {
          setSavingWeekly(false);
        }
      }}
      onUpsertOverride={async ({ date, kind, slots }) => {
        setSavingOverride(true);
        try {
          await upsertOverride({ date, kind, slots });
        } finally {
          setSavingOverride(false);
        }
      }}
      onClearOverride={async (date) => {
        setSavingOverride(true);
        try {
          await clearOverride({ date });
        } finally {
          setSavingOverride(false);
        }
      }}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
