"use client";

import { createDayRangeView } from "./dayRangeView";

/**
 * Custom rolling 7-day "Week" view. Unlike RBC's built-in week (which snaps to
 * Sun–Sat), this starts at the focused date, so the toolbar's one-day prev/next
 * arrows move the window a single day at a time.
 */
export const WeekView = createDayRangeView(7);
