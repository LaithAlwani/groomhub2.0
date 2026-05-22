import type { CSSProperties } from "react";

export const pastSlotStyle: CSSProperties = {
  backgroundColor: "rgba(228, 228, 231, 0.6)",
  cursor: "not-allowed",
};

// Blocked-off times (outside weekly schedule, day-off overrides) — light red
// so the user can tell at a glance versus a regular empty slot.
export const unavailableSlotStyle: CSSProperties = {
  backgroundColor: "rgba(254, 226, 226, 0.55)",
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(248,113,113,0.22) 6px, rgba(248,113,113,0.22) 12px)",
  cursor: "not-allowed",
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  color?: string;
};

export function eventStyle(event: CalendarEvent) {
  if (event.status === "pendingApproval") {
    return {
      style: {
        backgroundColor: "#fef3c7", // amber-100
        borderColor: "#d97706", // amber-600
        borderWidth: 2,
        borderStyle: "dashed",
        color: "#78350f", // amber-900
        borderRadius: 6,
        padding: "2px 6px",
        fontSize: 12,
      },
    };
  }
  if (event.status === "declined") {
    return {
      style: {
        backgroundColor: "#fee2e2", // red-100
        borderColor: "#dc2626", // red-600
        borderWidth: 2,
        borderStyle: "dashed",
        color: "#7f1d1d", // red-900
        borderRadius: 6,
        padding: "2px 6px",
        fontSize: 12,
      },
    };
  }
  const baseColor = event.color ?? "#2563eb"; // blue-600
  const muted = event.status === "cancelled" || event.status === "noShow";
  return {
    style: {
      backgroundColor: muted ? "#a1a1aa" : baseColor,
      borderColor: muted ? "#71717a" : baseColor,
      color: "white",
      opacity: muted ? 0.65 : 1,
      borderRadius: 6,
      padding: "2px 6px",
      fontSize: 12,
    },
  };
}

export function computeBounds(
  availabilityByDate: Record<string, Array<{ startMin: number; endMin: number }>>,
): { min: Date; max: Date } {
  let earliest = Infinity;
  let latest = -Infinity;
  for (const slots of Object.values(availabilityByDate)) {
    for (const slot of slots) {
      if (slot.startMin < earliest) earliest = slot.startMin;
      if (slot.endMin > latest) latest = slot.endMin;
    }
  }
  if (earliest === Infinity || latest === -Infinity) {
    return { min: makeTime(6, 0), max: makeTime(22, 0) };
  }
  // Snap bounds to whole hours so the time gutter labels land on the top of
  // each hour (9, 10, 11…) rather than at :30 marks.
  const startHour = Math.max(0, Math.floor(earliest / 60));
  const endHour = Math.min(24, Math.ceil(latest / 60));
  return {
    min: makeTime(startHour, 0),
    max: makeTime(endHour, 0),
  };
}

export function makeTime(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function isoDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
