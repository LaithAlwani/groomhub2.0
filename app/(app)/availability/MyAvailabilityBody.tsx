"use client";

import { SlotAvailabilityEditor } from "@/components/availability/slots/SlotAvailabilityEditor";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

export function MyAvailabilityBody() {
  const { current, loading } = useCurrentLocation();
  const locationId = current?._id ?? null;

  if (loading || !locationId) return <EditorSkeleton />;

  // Key by location so switching shops re-seeds the editor from fresh data.
  return <SlotAvailabilityEditor key={locationId} locationId={locationId} />;
}

function EditorSkeleton() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4">
      <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
