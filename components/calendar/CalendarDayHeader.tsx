"use client";

/**
 * Custom day-of-week header for react-big-calendar. Renders the 3-letter
 * weekday label (uppercase) above the day number, with a subtle highlight on
 * today's column. Wired via `components={{ header: CalendarDayHeader }}`.
 */
export function CalendarDayHeader({
  date,
  label: _label,
}: {
  date: Date;
  label: string;
}) {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const weekday = date
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase();
  const day = date.getDate();

  const className = isToday
    ? "flex flex-col items-center gap-0.5 rounded-md bg-sky-50 py-2 dark:bg-sky-950/40"
    : "flex flex-col items-center gap-0.5 py-2";

  return (
    <div className={className}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {weekday}
      </span>
      <span
        className={
          isToday
            ? "text-xl font-semibold text-[#00273c] dark:text-sky-300"
            : "text-xl font-medium text-zinc-700 dark:text-zinc-200"
        }
      >
        {day}
      </span>
    </div>
  );
}
