"use client";

/**
 * Left rail of the weekly timeline grid. Renders an empty spacer that
 * matches the day column header (h-14) so the hour labels below stay
 * aligned with the hour grid lines inside each TimelineDayColumn.
 */
export function TimeGutterColumn({
  pixelsPerMin,
  hourCount,
  startHour,
}: {
  pixelsPerMin: number;
  hourCount: number;
  startHour: number;
}) {
  const totalHeight = hourCount * 60 * pixelsPerMin;
  return (
    <div className="flex min-h-0 flex-col">
      <div className="h-14 border-b border-r border-zinc-200 dark:border-zinc-800" />
      <div
        className="relative border-r border-zinc-200 dark:border-zinc-800"
        style={{ height: totalHeight }}
      >
        {Array.from({ length: hourCount }).map((_, hourIndex) => (
          <div
            key={hourIndex}
            style={{ top: hourIndex * 60 * pixelsPerMin }}
            className="absolute inset-x-0 -translate-y-1.5 pr-2 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
          >
            {formatHour(startHour + hourIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}
