"use client";

import { createDayRangeView } from "./dayRangeView";

/**
 * Custom rolling 3-day view for react-big-calendar. Shows the focused day plus
 * the next two; the toolbar's one-day arrows shift it a day at a time.
 */
export const ThreeDayView = createDayRangeView(3);
