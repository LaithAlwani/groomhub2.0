import { WEEKDAYS } from "@/lib/time";
import type { DayRange } from "./TimelineDayColumn";

export type WeeklyRange = { weekday: number; startMin: number; endMin: number };

/** Flatten the list of `{ weekday, start, end }` ranges into a 7-element
 * array of per-weekday ranges, sorted by start time. */
export function fromWeeklyRanges(
  ranges: ReadonlyArray<WeeklyRange>,
): DayRange[][] {
  const grid: DayRange[][] = Array.from({ length: 7 }, () => []);
  for (const range of ranges) {
    grid[range.weekday].push({ startMin: range.startMin, endMin: range.endMin });
  }
  for (const day of grid) day.sort((a, b) => a.startMin - b.startMin);
  return grid;
}

/** Returns a human-readable error string if the grid is invalid, or null. */
export function validateWeeklyGrid(grid: DayRange[][]): string | null {
  for (let weekday = 0; weekday < 7; weekday++) {
    const rows = [...grid[weekday]].sort((a, b) => a.startMin - b.startMin);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (row.startMin >= row.endMin) {
        return `${WEEKDAYS[weekday]}: start time must be before end time.`;
      }
      if (index > 0 && row.startMin < rows[index - 1].endMin) {
        return `${WEEKDAYS[weekday]}: ranges overlap.`;
      }
    }
  }
  return null;
}
