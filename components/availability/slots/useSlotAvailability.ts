"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatError } from "@/lib/formatError";
import { addDaysIso, todayIsoDate } from "@/lib/time";
import {
  buildPills,
  dateKey,
  dowOf,
  effectiveForDate,
  overrideEquals,
  overridesFromRows,
  slotsToMin,
  validateSlots,
  weeklyFromRows,
  weeklyToRows,
  type OverrideState,
  type Slot,
  type WeeklyState,
} from "./availabilitySlots";

const VISIBLE_STEP = 21; // days rendered initially / added per "load more"
const MAX_DAYS = 120; // overrides are sparse, so load the whole window once

type Snapshot = { weekly: WeeklyState; overrides: OverrideState };

/**
 * All state + persistence for the slot availability editor. Edits land on the
 * weekly template when the day is following the weekly repeat, otherwise on a
 * per-date override — exactly like the design's `mutateSlots`. Save flushes the
 * weekly template plus a diff of the overrides to Convex.
 */
export function useSlotAvailability(locationId: Id<"locations">) {
  const fromDate = todayIsoDate();
  const toDate = addDaysIso(todayIsoDate(), MAX_DAYS);
  const weeklyRows = useQuery(api.availability.myWeekly, { locationId });
  const overrideRows = useQuery(api.availability.myOverridesInRange, {
    locationId,
    fromDate,
    toDate,
  });
  const upsertWeekly = useMutation(api.availability.upsertMyWeekly);
  const upsertOverride = useMutation(api.availability.upsertMyOverride);
  const clearOverride = useMutation(api.availability.clearMyOverride);

  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today));
  const [visibleDays, setVisibleDays] = useState(VISIBLE_STEP);
  const [weekly, setWeekly] = useState<WeeklyState | null>(null);
  const [overrides, setOverrides] = useState<OverrideState | null>(null);
  const [initial, setInitial] = useState<Snapshot | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Seed once when both queries resolve (render-time adjust, no effect).
  if (weeklyRows !== undefined && overrideRows !== undefined && weekly === null) {
    const seededWeekly = weeklyFromRows(weeklyRows);
    const seededOverrides = overridesFromRows(overrideRows);
    setWeekly(seededWeekly);
    setOverrides(seededOverrides);
    setInitial({ weekly: seededWeekly, overrides: seededOverrides });
  }

  const ready = weekly !== null && overrides !== null && initial !== null;

  const pills = useMemo(
    () =>
      buildPills(today, visibleDays, selectedDate, weekly ?? {}, overrides ?? {}),
    [today, visibleDays, selectedDate, weekly, overrides],
  );
  const effective = useMemo(
    () => effectiveForDate(selectedDate, weekly ?? {}, overrides ?? {}),
    [selectedDate, weekly, overrides],
  );

  function mutateSlots(fn: (slots: Slot[]) => void) {
    if (!weekly || !overrides) return;
    const eff = effectiveForDate(selectedDate, weekly, overrides);
    if (eff.repeat) {
      const weekday = dowOf(selectedDate);
      const day = { ...weekly[weekday] };
      const nextSlots = day.slots.map((slot) => ({ ...slot }));
      fn(nextSlots);
      setWeekly({
        ...weekly,
        [weekday]: { on: nextSlots.length > 0, slots: nextSlots },
      });
      setErrors({ ...errors, [selectedDate]: validateSlots(nextSlots) });
    } else {
      const existing = overrides[selectedDate];
      const base = (
        existing && "slots" in existing ? existing.slots : eff.slots
      ).map((slot) => ({ ...slot }));
      fn(base);
      setOverrides({ ...overrides, [selectedDate]: { slots: base } });
      setErrors({ ...errors, [selectedDate]: validateSlots(base) });
    }
  }

  const handlers = {
    addSlot: () =>
      mutateSlots((slots) => {
        const last = slots[slots.length - 1];
        const start = last ? Math.min(last.end + 1, 22) : 9;
        const end = Math.min(start + 1, 23.5);
        const id = Math.max(0, ...slots.map((slot) => slot.id)) + 1;
        slots.push({ id, start, end });
      }),
    removeSlot: (slotId: number) =>
      mutateSlots((slots) => {
        const index = slots.findIndex((slot) => slot.id === slotId);
        if (index > -1) slots.splice(index, 1);
      }),
    slotTimeChange: (slotId: number, which: "start" | "end", value: string) =>
      mutateSlots((slots) => {
        const slot = slots.find((entry) => entry.id === slotId);
        if (slot) slot[which] = parseFloat(value);
      }),
    toggleBookOff: () => {
      if (!overrides) return;
      const existing = overrides[selectedDate];
      const next = { ...overrides };
      if (existing && "bookedOff" in existing) delete next[selectedDate];
      else next[selectedDate] = { bookedOff: true };
      setOverrides(next);
    },
    toggleRepeat: () => {
      if (!weekly || !overrides) return;
      const eff = effectiveForDate(selectedDate, weekly, overrides);
      if (eff.repeat) {
        // Detach: freeze the weekly slots as a one-off override for this date.
        setOverrides({
          ...overrides,
          [selectedDate]: { slots: eff.slots.map((slot) => ({ ...slot })) },
        });
      } else {
        // Adopt: this date's slots become the weekly template for its weekday.
        const weekday = dowOf(selectedDate);
        setWeekly({
          ...weekly,
          [weekday]: {
            on: eff.slots.length > 0,
            slots: eff.slots.map((slot) => ({ ...slot })),
          },
        });
        const next = { ...overrides };
        delete next[selectedDate];
        setOverrides(next);
      }
    },
  };

  const dirty =
    ready &&
    initial !== null &&
    (JSON.stringify(weekly) !== JSON.stringify(initial.weekly) ||
      JSON.stringify(overrides) !== JSON.stringify(initial.overrides));

  function discard() {
    if (!initial) return;
    setWeekly(initial.weekly);
    setOverrides(initial.overrides);
    setErrors({});
    setServerError(null);
  }

  function loadMore() {
    setVisibleDays((days) => Math.min(days + VISIBLE_STEP, MAX_DAYS));
  }

  function goToToday() {
    setSelectedDate(dateKey(today));
  }

  async function save() {
    if (!weekly || !overrides || !initial) return;
    if (Object.values(errors).some(Boolean)) {
      setServerError("Fix the highlighted slot errors first.");
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      await upsertWeekly({ locationId, ranges: weeklyToRows(weekly) });
      const dates = new Set([
        ...Object.keys(overrides),
        ...Object.keys(initial.overrides),
      ]);
      for (const date of dates) {
        const current = overrides[date];
        const before = initial.overrides[date];
        if (!current && before) {
          await clearOverride({ locationId, date });
        } else if (current && !overrideEquals(current, before)) {
          if ("bookedOff" in current) {
            await upsertOverride({ locationId, date, kind: "off" });
          } else {
            await upsertOverride({
              locationId,
              date,
              kind: "custom",
              slots: slotsToMin(current.slots),
            });
          }
        }
      }
      setInitial({ weekly, overrides });
    } catch (caught) {
      setServerError(formatError(caught, "Could not save availability."));
    } finally {
      setSaving(false);
    }
  }

  return {
    ready,
    pills,
    atToday: selectedDate === dateKey(today),
    selectedDate,
    setSelectedDate,
    effective,
    error: errors[selectedDate] ?? "",
    handlers,
    dirty,
    saving,
    serverError,
    save,
    discard,
    loadMore,
    goToToday,
  };
}
